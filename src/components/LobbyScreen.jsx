import { useEffect, useRef, useState } from 'react'
import { cuisines } from '../data/cuisines'
import { fetchGroupMembers, joinGroup, leaveGroup, leaveGroupBeacon, startSwipeSession } from '../lib/groups'
import { fetchGroupSessionResults, recordSessionResult } from '../lib/sessionResults'
import { clearGroupTally, createGroupTally } from '../lib/groupTallies'
import { buildDeck, DEFAULT_SETTINGS } from '../lib/deck'
import SwipeSettings from './SwipeSettings'
import Modal from './Modal'
import { GearIcon } from './icons'
import { supabase } from '../lib/supabase'

const MAX_HISTORY_ITEMS = 5

function LobbyScreen({ group, isHost, onLeave, onStart, onQuickResult, initialMemberId }) {
  const [members, setMembers] = useState([])
  const [membersStatus, setMembersStatus] = useState('loading') // loading | ready | error
  const [membersError, setMembersError] = useState('')

  const [displayName, setDisplayName] = useState('')
  // If we're already a member (e.g. returning here via "Play again"), skip the join form.
  const [joinStatus, setJoinStatus] = useState(initialMemberId ? 'joined' : 'idle') // idle | joining | joined | error
  const [joinError, setJoinError] = useState('')

  const [memberId, setMemberId] = useState(initialMemberId ?? null)
  const memberIdRef = useRef(initialMemberId ?? null)
  const [leaving, setLeaving] = useState(false)

  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const [history, setHistory] = useState([]) // [{ cuisine, count }], most frequent first
  const [quickPicking, setQuickPicking] = useState(false)
  const [quickPickError, setQuickPickError] = useState('')

  const [kickingId, setKickingId] = useState(null)
  const [kickError, setKickError] = useState('')
  const [kickedOut, setKickedOut] = useState(false)

  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Only the host needs this — it's just for the quick-pick shortcuts below.
  useEffect(() => {
    if (!isHost) return
    let cancelled = false

    fetchGroupSessionResults(group.id)
      .then((rows) => {
        if (cancelled) return

        const counts = {}
        const mostRecentDecidedAt = {}
        for (const row of rows) {
          counts[row.winning_cuisine] = (counts[row.winning_cuisine] ?? 0) + 1
          if (!mostRecentDecidedAt[row.winning_cuisine]) {
            mostRecentDecidedAt[row.winning_cuisine] = row.decided_at // rows are already newest-first
          }
        }

        const ranked = Object.keys(counts)
          .map((name) => ({
            cuisine: cuisines.find((c) => c.name === name),
            count: counts[name],
            mostRecent: mostRecentDecidedAt[name],
          }))
          .filter((entry) => entry.cuisine) // drop anything that doesn't match the current list
          .sort((a, b) => b.count - a.count || new Date(b.mostRecent) - new Date(a.mostRecent))
          .slice(0, MAX_HISTORY_ITEMS)

        setHistory(ranked)
      })
      .catch((err) => console.error('Could not load group history:', err))
  }, [group.id, isHost])

  async function loadMembers() {
    setMembersStatus('loading')
    try {
      const data = await fetchGroupMembers(group.id)
      setMembers(data)
      setMembersStatus('ready')
    } catch (err) {
      setMembersError(err.message || 'Could not load group members.')
      setMembersStatus('error')
    }
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id])

  // Live-update the member list as people join or leave, and move everyone to the swipe
  // deck together once anyone starts the session.
  useEffect(() => {
    const channel = supabase
      .channel(`group_members_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_members', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_members INSERT received:', payload.new)
          setMembers((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
        },
      )
      .on(
        // DELETE events can't be filtered server-side when RLS is on — Postgres only
        // exposes the primary key in the old record (Realtime strips everything else so
        // it can't leak data an RLS policy wouldn't otherwise allow reading). So this
        // listens to every group_members delete and filters client-side by checking the
        // deleted id against who we already know is in *our* group.
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_members' },
        (payload) => {
          console.log('[realtime] group_members DELETE received:', payload.old)
          setMembers((prev) => prev.filter((m) => m.id !== payload.old.id))
          if (memberIdRef.current && payload.old.id === memberIdRef.current) {
            setKickedOut(true)
          }
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id])

  // Separate channel: watches the group row itself so that whoever DIDN'T click "Start
  // swiping" still gets moved to the swipe deck the moment someone else does. Also
  // watches for a quick-pick decision landing directly in group_tallies, which skips
  // the swipe deck entirely and sends everyone straight to the results screen.
  useEffect(() => {
    const channel = supabase
      .channel(`groups_${group.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] groups UPDATE received:', payload.new)
          if (payload.new.started_at && memberIdRef.current) {
            onStart(memberIdRef.current)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_tallies', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] group_tallies INSERT received (quick pick):', payload.new)
          if (memberIdRef.current) {
            onQuickResult(memberIdRef.current)
          }
        },
      )
      .subscribe((status, err) => {
        console.log('[realtime] groups subscription status:', status, err ?? '')
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id])

  useEffect(() => {
    memberIdRef.current = memberId
  }, [memberId])

  // Best-effort cleanup if the tab is closed or navigated away without clicking "Leave
  // group" — not guaranteed to run (browsers don't promise unload handlers fire), so the
  // explicit button below is the reliable path and this is just a nice-to-have.
  useEffect(() => {
    function handlePageHide() {
      if (memberIdRef.current) {
        leaveGroupBeacon(memberIdRef.current)
      }
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  async function handleJoin(event) {
    event.preventDefault()
    const trimmedName = displayName.trim()
    if (!trimmedName) return

    setJoinStatus('joining')
    setJoinError('')
    try {
      const member = await joinGroup(group.id, trimmedName, isHost)
      setMemberId(member.id)
      setJoinStatus('joined')
      await loadMembers()
    } catch (err) {
      setJoinError(err.message || 'Could not join the group. Please try again.')
      setJoinStatus('error')
    }
  }

  async function handleLeaveGroup() {
    setLeaving(true)
    try {
      if (memberId) {
        await leaveGroup(memberId)
      }
    } catch (err) {
      console.error('Could not remove group_members row on leave:', err)
      // Still let the user leave the screen even if the cleanup call failed.
    } finally {
      onLeave()
    }
  }

  async function handleKickMember(targetMemberId) {
    setKickingId(targetMemberId)
    setKickError('')
    try {
      await leaveGroup(targetMemberId)
      // The group_members DELETE broadcast above removes them from `members` for
      // everyone, including the person who got kicked — no local update needed here.
    } catch (err) {
      setKickError(err.message || 'Could not remove that member. Please try again.')
    } finally {
      setKickingId(null)
    }
  }

  async function handleStartSwiping() {
    setStarting(true)
    setStartError('')
    try {
      // Resolve the deck once, here, and store the exact result — if every member's
      // client independently re-sampled from settings instead, a deck size smaller than
      // the pool could give different members different subsets to vote on.
      const deck = await buildDeck(settings)
      if (deck.length === 0) {
        setStartError('No items match the selected filters. Try different settings.')
        setStarting(false)
        return
      }
      await startSwipeSession(group.id, { cardType: settings.cardType, deckItemNames: deck.map((item) => item.name) })
      // Everyone else moves on once the `groups` UPDATE broadcasts; do it immediately
      // for the clicker too rather than waiting on our own round-trip.
      onStart(memberId)
    } catch (err) {
      setStartError(err.message || 'Could not start the swipe session. Please try again.')
      setStarting(false)
    }
  }

  async function handleQuickPick(cuisineName) {
    setQuickPicking(true)
    setQuickPickError('')
    try {
      await clearGroupTally(group.id)
      await createGroupTally(group.id, [cuisineName], cuisineName)
      await recordSessionResult(group.id, cuisineName)
      // Same pattern as "Start swiping": everyone else moves on via the group_tallies
      // INSERT broadcast above; do it immediately here too rather than waiting on it.
      onQuickResult(memberId)
    } catch (err) {
      setQuickPickError(err.message || 'Could not use that pick. Please try again.')
      setQuickPicking(false)
    }
  }

  if (kickedOut) {
    return (
      <div className="lobby-screen">
        <h2>You've been removed from this group.</h2>
        <button type="button" className="btn btn-primary" onClick={onLeave}>
          Back to home
        </button>
      </div>
    )
  }

  return (
    <div className="lobby-screen">
      {isHost && (
        <button
          type="button"
          className="settings-trigger"
          onClick={() => setSettingsOpen(true)}
          aria-label="Session settings"
        >
          <GearIcon />
        </button>
      )}

      <p className="lobby-label">Room code</p>
      <div className="room-code-display">{group.room_code}</div>
      <p className="lobby-hint">Share this code so others can join.</p>

      {joinStatus !== 'joined' && (
        <form className="join-form" onSubmit={handleJoin}>
          <input
            type="text"
            className="room-code-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            autoFocus
            maxLength={40}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={joinStatus === 'joining' || !displayName.trim()}
          >
            {joinStatus === 'joining' ? 'Joining…' : 'Join lobby'}
          </button>
        </form>
      )}
      {joinStatus === 'error' && <p className="form-error">{joinError}</p>}

      <div className="member-list-section">
        <div className="member-list-header">
          <h3>Who's here</h3>
          <button type="button" className="btn btn-refresh" onClick={loadMembers} disabled={membersStatus === 'loading'}>
            {membersStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {membersStatus === 'loading' && <p className="restaurant-status">Loading members…</p>}
        {membersStatus === 'error' && <p className="restaurant-status restaurant-error">{membersError}</p>}
        {membersStatus === 'ready' && members.length === 0 && (
          <p className="restaurant-status">No one has joined yet.</p>
        )}
        {membersStatus === 'ready' && members.length > 0 && (
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id}>
                <span>{m.display_name}</span>
                {isHost && m.id !== memberId && (
                  <button
                    type="button"
                    className="btn btn-kick"
                    onClick={() => handleKickMember(m.id)}
                    disabled={kickingId === m.id}
                  >
                    {kickingId === m.id ? 'Kicking…' : 'Kick'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {kickError && <p className="form-error">{kickError}</p>}
      </div>

      {joinStatus === 'joined' && isHost && history.length > 0 && (
        <div className="history-section">
          <p className="lobby-hint">Or pick something you've had before:</p>
          <div className="cuisine-chip-row">
            {history.map(({ cuisine, count }) => (
              <button
                key={cuisine.id}
                type="button"
                className="pill-tab"
                onClick={() => handleQuickPick(cuisine.name)}
                disabled={quickPicking || starting}
              >
                {cuisine.emoji} {cuisine.name}
                {count > 1 ? ` (won ${count} times)` : ''}
              </button>
            ))}
          </div>
          {quickPickError && <p className="form-error">{quickPickError}</p>}
        </div>
      )}

      {settingsOpen && (
        <Modal title="Session settings" onClose={() => setSettingsOpen(false)}>
          <SwipeSettings settings={settings} onChange={setSettings} disabled={starting || quickPicking} />
        </Modal>
      )}

      {joinStatus === 'joined' && isHost && (
        <button type="button" className="btn btn-primary" onClick={handleStartSwiping} disabled={starting || quickPicking}>
          {starting ? 'Starting…' : 'Start swiping'}
        </button>
      )}
      {joinStatus === 'joined' && !isHost && (
        <p className="restaurant-status">Waiting for the host to start swiping…</p>
      )}
      {startError && <p className="form-error">{startError}</p>}

      <button type="button" className="btn btn-restart" onClick={handleLeaveGroup} disabled={leaving}>
        {leaving ? 'Leaving…' : 'Leave group'}
      </button>
    </div>
  )
}

export default LobbyScreen
