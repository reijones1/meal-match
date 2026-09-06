import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_TYPES, resolveDeckItems } from '../lib/deck'
import SwipeDeck from './SwipeDeck'
import SoundToggle from './SoundToggle'
import { fetchGroup, fetchGroupMembers, updateMemberLocation } from '../lib/groups'
import { fetchGroupSwipes, recordSwipe } from '../lib/swipes'
import { getCurrentPosition } from '../lib/geolocation'
import { supabase } from '../lib/supabase'

function GroupSwipeScreen({ group, memberId, onAllFinished }) {
  // The host already picked the exact set of items when they started the session (see
  // LobbyScreen's handleStartSwiping) — this just looks up that same set by name and
  // shuffles the *order* locally, so every member votes on the same deck.
  const [deck, setDeck] = useState(null)
  const [deckError, setDeckError] = useState('')
  const [index, setIndex] = useState(0)
  const isFinished = deck != null && index >= deck.length

  const [totalMembers, setTotalMembers] = useState(null)
  // { [memberId]: Set(cuisine_name) } — a member has "finished" once their set covers
  // every cuisine in the deck.
  const [swipesByMember, setSwipesByMember] = useState({})
  // { [cuisine_name]: Set(member_id) } — who's already said yes to each cuisine, purely for
  // the "N others already said yum!" tease while swiping (see teaseText below).
  const [likesByCuisine, setLikesByCuisine] = useState({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const groupRow = await fetchGroup(group.id)
        const cardType = groupRow?.card_type || CARD_TYPES.CUISINES
        const names = groupRow?.deck_items ?? []
        const resolved = await resolveDeckItems(cardType, names)
        if (cancelled) return
        setDeck(resolved)
      } catch (err) {
        if (!cancelled) setDeckError(err.message || 'Could not load the deck. Please try again.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [group.id])

  useEffect(() => {
    fetchGroupMembers(group.id)
      .then((members) => setTotalMembers(members.length))
      .catch(() => {
        // Best-effort; the progress indicator just shows "Loading group…" if this fails.
      })
  }, [group.id])

  // Shares this device's location alongside voting, the same "just send it" way swipes
  // themselves are recorded — the group restaurant search (once a cuisine wins) needs every
  // participant's location, not just whoever happens to view the results screen first.
  // A denied/unavailable location just leaves this member's lat/lng null; the group search
  // still works from whoever else shared theirs (or the "Adjust search area" panel).
  useEffect(() => {
    getCurrentPosition()
      .then((coords) => updateMemberLocation(memberId, coords))
      .catch((err) => console.error('Could not share location with the group:', err))
  }, [memberId])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rows = await fetchGroupSwipes(group.id)
        if (cancelled) return
        const tally = {}
        const likes = {}
        for (const row of rows) {
          if (!tally[row.member_id]) tally[row.member_id] = new Set()
          tally[row.member_id].add(row.cuisine_name)
          if (row.liked) {
            if (!likes[row.cuisine_name]) likes[row.cuisine_name] = new Set()
            likes[row.cuisine_name].add(row.member_id)
          }
        }
        setSwipesByMember(tally)
        setLikesByCuisine(likes)
      } catch (err) {
        console.error('Could not load existing swipes:', err)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [group.id])

  useEffect(() => {
    const channel = supabase
      .channel(`swipes_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'swipes', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] swipes INSERT received:', payload.new)
          const row = payload.new
          setSwipesByMember((prev) => {
            const next = { ...prev }
            const existing = next[row.member_id] ?? new Set()
            const updated = new Set(existing)
            updated.add(row.cuisine_name)
            next[row.member_id] = updated
            return next
          })
          if (row.liked) {
            setLikesByCuisine((prev) => {
              const next = { ...prev }
              const existing = next[row.cuisine_name] ?? new Set()
              const updated = new Set(existing)
              updated.add(row.member_id)
              next[row.cuisine_name] = updated
              return next
            })
          }
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] swipes subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id])

  const finishedCount = useMemo(() => {
    if (deck == null) return 0
    return Object.values(swipesByMember).filter((cuisineSet) => cuisineSet.size >= deck.length).length
  }, [swipesByMember, deck])

  // Every member's client independently derives this from the same realtime-synced
  // swipe data, so there's no separate signal needed here — unlike "start swiping,"
  // this isn't a human decision, it's a fact that becomes true for everyone at once.
  const allFinishedRef = useRef(false)
  useEffect(() => {
    if (totalMembers != null && totalMembers > 0 && finishedCount === totalMembers && !allFinishedRef.current) {
      allFinishedRef.current = true
      onAllFinished()
    }
  }, [finishedCount, totalMembers, onAllFinished])

  // "N others already said yum!" — a light, non-intrusive nod to the fact this is a group
  // session, only shown when it's actually true for the card currently on screen.
  const teaseText = useMemo(() => {
    if (deck == null || isFinished) return null
    const likers = likesByCuisine[deck[index].name]
    if (!likers) return null
    const count = [...likers].filter((id) => id !== memberId).length
    if (count === 0) return null
    return `${count} other${count === 1 ? '' : 's'} already said yum!`
  }, [isFinished, deck, index, likesByCuisine, memberId])

  function handleSwipe(direction) {
    const item = deck[index]
    setIndex((prev) => prev + 1)
    recordSwipe(group.id, memberId, item.name, direction === 'right').catch((err) => {
      console.error('Could not save swipe:', err)
      // Swiping continues locally either way — a dropped save just means this one
      // item won't count toward the group tally or, later, the final results.
    })
  }

  if (deckError) {
    return <p className="restaurant-status restaurant-error">{deckError}</p>
  }

  if (deck == null) {
    return <p className="restaurant-status">Loading deck…</p>
  }

  return (
    <div className="app">
      {!isFinished && <SoundToggle />}
      <h1 className="app-title">Meal Match</h1>
      <p className="group-progress">
        {totalMembers == null ? 'Loading group…' : `${finishedCount} of ${totalMembers} have finished`}
      </p>

      {isFinished ? (
        <p className="restaurant-status">You're all done! Waiting on the rest of the group…</p>
      ) : (
        <SwipeDeck deck={deck} index={index} onSwipe={handleSwipe} teaseText={teaseText} />
      )}
    </div>
  )
}

export default GroupSwipeScreen
