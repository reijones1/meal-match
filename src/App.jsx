import { useState } from 'react'
import HomeScreen from './components/HomeScreen'
import JoinGroupScreen from './components/JoinGroupScreen'
import LobbyScreen from './components/LobbyScreen'
import GroupSwipeScreen from './components/GroupSwipeScreen'
import GroupResultsScreen from './components/GroupResultsScreen'
import SoloSwipeApp from './SoloSwipeApp'
import { createGroup, findGroupByRoomCode, resetGroupRound } from './lib/groups'
import './App.css'

function App() {
  const [screen, setScreen] = useState('home') // home | join | lobby | swipe | results | solo
  const [activeGroup, setActiveGroup] = useState(null)
  const [activeMemberId, setActiveMemberId] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreateGroup() {
    setCreating(true)
    setCreateError('')
    try {
      const group = await createGroup()
      setActiveGroup(group)
      setIsHost(true)
      setScreen('lobby')
    } catch (err) {
      setCreateError(err.message || 'Could not create a group. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinGroup(roomCode) {
    // Fetched fresh on every submit (not cached from when the join screen loaded), so a
    // round that starts while someone is mid-entry is still caught right here.
    const group = await findGroupByRoomCode(roomCode)
    if (!group) {
      throw new Error(`No group found with code "${roomCode}". Double-check the code and try again.`)
    }
    if (group.round_started) {
      throw new Error('This group already started — ask them to start a new session.')
    }
    setActiveGroup(group)
    setIsHost(false)
    setScreen('lobby')
  }

  function handleLeaveLobby() {
    setActiveGroup(null)
    setActiveMemberId(null)
    setIsHost(false)
    setScreen('home')
  }

  function handleStartSwiping(memberId) {
    setActiveMemberId(memberId)
    setScreen('swipe')
  }

  function handleAllFinished() {
    setScreen('results')
  }

  function handleQuickResult(memberId) {
    setActiveMemberId(memberId)
    setScreen('results')
  }

  function handlePlayAgain() {
    // Keep activeGroup/activeMemberId/isHost intact — we're still the same member of
    // the same group, just heading back to the lobby for another round. Reopens the join
    // screen for this group now that it's back in the lobby, not mid-round — best-effort,
    // since nothing on this screen depends on it having landed.
    resetGroupRound(activeGroup.id).catch((err) => console.error('Could not reopen the group for new joins:', err))
    setScreen('lobby')
  }

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          onCreateGroup={handleCreateGroup}
          onJoinGroup={() => setScreen('join')}
          onPlaySolo={() => setScreen('solo')}
          creating={creating}
          createError={createError}
        />
      )}
      {screen === 'solo' && <SoloSwipeApp onExit={() => setScreen('home')} />}
      {screen === 'join' && <JoinGroupScreen onJoin={handleJoinGroup} onBack={() => setScreen('home')} />}
      {screen === 'lobby' && activeGroup && (
        <LobbyScreen
          group={activeGroup}
          isHost={isHost}
          onLeave={handleLeaveLobby}
          onStart={handleStartSwiping}
          onQuickResult={handleQuickResult}
          initialMemberId={activeMemberId}
        />
      )}
      {screen === 'swipe' && activeGroup && activeMemberId && (
        <GroupSwipeScreen group={activeGroup} memberId={activeMemberId} onAllFinished={handleAllFinished} />
      )}
      {screen === 'results' && activeGroup && activeMemberId && (
        <GroupResultsScreen
          group={activeGroup}
          memberId={activeMemberId}
          isHost={isHost}
          onLeave={handleLeaveLobby}
          onPlayAgain={handlePlayAgain}
          onStart={handleStartSwiping}
        />
      )}
    </div>
  )
}

export default App
