import { useEffect, useRef, useState } from 'react'
import { CARD_TYPES, resolveDeckItems } from '../lib/deck'
import ResultScreen from './ResultScreen'
import TieBreakScreen from './TieBreakScreen'
import DrawScreen from './DrawScreen'
import GroupRestaurantResults from './GroupRestaurantResults'
import { fetchGroup, fetchGroupMembers, leaveGroup, startRematchSession } from '../lib/groups'
import { fetchGroupSwipes } from '../lib/swipes'
import { recordSessionResult } from '../lib/sessionResults'
import { computeMajorityResult, createGroupTally, fetchGroupTally, resolveGroupTally, skipRematch } from '../lib/groupTallies'
import { supabase } from '../lib/supabase'

function GroupResultsScreen({ group, memberId, isHost, onLeave, onPlayAgain, onStart }) {
  // The shared record every screen renders from — never derived locally except by
  // the host, whose one job is to compute it once and write it here.
  const [tally, setTally] = useState(null)
  const [groupRow, setGroupRow] = useState(null)
  const [resolvedItems, setResolvedItems] = useState(null)
  const [totalMembers, setTotalMembers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(false)
  const [decideError, setDecideError] = useState('')
  const [rematching, setRematching] = useState(false)
  const [rematchError, setRematchError] = useState('')
  const hostComputedRef = useRef(false)

  const cardType = groupRow?.card_type || CARD_TYPES.CUISINES

  // Catch up on whatever's already there — covers a client mounting after the tally
  // (or even the final decision) was already written by someone else. Also need to know
  // which pool (cuisines or dishes) this round used, to resolve names back into full items.
  useEffect(() => {
    let cancelled = false
    Promise.all([fetchGroupTally(group.id), fetchGroup(group.id)])
      .then(([tallyRow, groupData]) => {
        if (cancelled) return
        setTally(tallyRow)
        setGroupRow(groupData)
      })
      .catch((err) => console.error('Could not load group tally:', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [group.id])

  // Needed for the majority check below — "more than half the group" requires knowing
  // how big the group actually is.
  useEffect(() => {
    fetchGroupMembers(group.id)
      .then((members) => setTotalMembers(members.length))
      .catch((err) => console.error('Could not load group members:', err))
  }, [group.id])

  // Every screen transition (swiping done -> draw/tie-break -> final winner) comes from
  // this one subscription reacting to the shared row, never from local computation.
  useEffect(() => {
    const channel = supabase
      .channel(`group_tallies_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_tallies', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_tallies INSERT received:', payload.new)
          setTally(payload.new)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_tallies', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_tallies UPDATE received:', payload.new)
          setTally(payload.new)
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] group_tallies subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id])

  // Mirrors LobbyScreen's own "groups started_at changed" subscription — the host
  // breaking the tie updates the same column the same way a fresh "Start swiping" does,
  // so everyone sitting on this results screen gets moved to the rematch round the same way.
  useEffect(() => {
    const channel = supabase
      .channel(`groups_results_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] groups UPDATE received (rematch):', payload.new)
          if (payload.new.started_at) onStart(memberId)
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] groups (results) subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id, memberId, onStart])

  // Resolve the tally's candidate names into full items (with emoji/description) against
  // whichever pool this round actually used — cuisines and dishes share names with no
  // relation to each other, so this can't be assumed, it has to look at card_type.
  useEffect(() => {
    if (!tally || !groupRow) return
    if (tally.candidate_cuisines.length === 0) {
      setResolvedItems([])
      return
    }
    let cancelled = false
    resolveDeckItems(cardType, tally.candidate_cuisines)
      .then((items) => {
        if (!cancelled) setResolvedItems(items)
      })
      .catch((err) => console.error('Could not resolve result items:', err))
    return () => {
      cancelled = true
    }
  }, [tally, groupRow, cardType])

  // Only the host computes the tally from raw swipes and writes it. Non-host clients
  // never run this — they only ever render whatever the row above contains.
  useEffect(() => {
    if (!isHost || loading || tally || hostComputedRef.current || totalMembers == null) return
    hostComputedRef.current = true

    async function computeAndWrite() {
      try {
        const rows = await fetchGroupSwipes(group.id)
        const { topNames, winningCuisine } = computeMajorityResult(rows, totalMembers)

        const row = await createGroupTally(group.id, topNames, winningCuisine)
        setTally(row)
        if (winningCuisine) {
          await recordSessionResult(group.id, winningCuisine)
        }
      } catch (err) {
        console.error('Could not compute/write group tally:', err)
      }
    }

    computeAndWrite()
  }, [isHost, loading, tally, group.id, totalMembers])

  async function handleDecide(cuisine) {
    setDeciding(true)
    setDecideError('')
    try {
      const row = await resolveGroupTally(group.id, cuisine.name)
      setTally(row)
      await recordSessionResult(group.id, cuisine.name)
    } catch (err) {
      setDecideError(err.message || 'Could not save the result. Please try again.')
    } finally {
      setDeciding(false)
    }
  }

  async function handleBreakTie() {
    setRematching(true)
    setRematchError('')
    try {
      await startRematchSession(group.id, { cardType, deckItemNames: tally.candidate_cuisines })
      // Everyone else moves on once the `groups` UPDATE broadcasts; do it immediately
      // for the clicker too rather than waiting on our own round-trip.
      onStart(memberId)
    } catch (err) {
      setRematchError(err.message || 'Could not start the rematch. Please try again.')
      setRematching(false)
    }
  }

  async function handleSkipRematch() {
    setRematchError('')
    try {
      const row = await skipRematch(group.id)
      setTally(row)
    } catch (err) {
      setRematchError(err.message || 'Could not skip the rematch. Please try again.')
    }
  }

  async function handleBackHome() {
    try {
      if (memberId) await leaveGroup(memberId)
    } catch (err) {
      console.error('Could not remove group_members row:', err)
    } finally {
      onLeave()
    }
  }

  if (loading || !tally || !groupRow || resolvedItems == null) {
    return <p className="restaurant-status">Tallying votes…</p>
  }

  const playAgain = { label: 'Play again', onClick: onPlayAgain }

  if (tally.candidate_cuisines.length === 0) {
    return <ResultScreen cuisines={[]} answers={{}} onRestart={handleBackHome} secondaryAction={playAgain} />
  }

  if (tally.winning_cuisine) {
    const winnerItem = resolvedItems.find((item) => item.name === tally.winning_cuisine)
    const answers = winnerItem ? { [winnerItem.id]: true } : {}
    return (
      <ResultScreen
        cuisines={resolvedItems}
        answers={answers}
        onRestart={handleBackHome}
        secondaryAction={playAgain}
        renderResults={(displayedCuisine) => (
          <GroupRestaurantResults group={group} isHost={isHost} cuisine={displayedCuisine} />
        )}
      />
    )
  }

  // No majority: either offer the one rematch round (first time this happens), or — if
  // that round's already been used, or the host chose to skip it — fall back to the
  // existing manual tie-break picker.
  const offerRematch = !groupRow.is_rematch && !tally.skip_rematch

  if (offerRematch) {
    return (
      <div className="results">
        <DrawScreen
          cuisines={resolvedItems}
          interactive={isHost}
          breaking={rematching}
          onBreakTie={handleBreakTie}
          onSkip={handleSkipRematch}
        />
        {rematchError && <p className="form-error">{rematchError}</p>}
      </div>
    )
  }

  return (
    <div className="results">
      <TieBreakScreen cuisines={resolvedItems} onPick={handleDecide} interactive={isHost} />
      {isHost && deciding && <p className="restaurant-status">Saving…</p>}
      {decideError && <p className="form-error">{decideError}</p>}
      {rematchError && <p className="form-error">{rematchError}</p>}
    </div>
  )
}

export default GroupResultsScreen
