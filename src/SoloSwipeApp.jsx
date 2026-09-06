import { useState } from 'react'
import { buildDeck, DEFAULT_SETTINGS } from './lib/deck'
import SwipeDeck from './components/SwipeDeck'
import ResultScreen from './components/ResultScreen'
import SwipeSettings from './components/SwipeSettings'
import Modal from './components/Modal'
import SoundToggle from './components/SoundToggle'
import { GearIcon } from './components/icons'

function SoloSwipeApp({ onExit }) {
  const [phase, setPhase] = useState('settings') // settings | swiping
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const [deckError, setDeckError] = useState('')

  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({}) // { [itemId]: true (yes) | false (no) }

  const isFinished = index >= deck.length

  async function handleStart() {
    setBuilding(true)
    setDeckError('')
    try {
      const built = await buildDeck(settings)
      if (built.length === 0) {
        setDeckError('No items match these filters. Try different settings.')
        return
      }
      setDeck(built)
      setIndex(0)
      setAnswers({})
      setPhase('swiping')
    } catch (err) {
      setDeckError(err.message || 'Could not build the deck. Please try again.')
    } finally {
      setBuilding(false)
    }
  }

  function handleSwipe(direction) {
    const current = deck[index]
    setAnswers((prev) => ({ ...prev, [current.id]: direction === 'right' }))
    setIndex((prev) => prev + 1)
  }

  function handleRestart() {
    setPhase('settings')
  }

  if (phase === 'settings') {
    return (
      <div className="app">
        <button
          type="button"
          className="settings-trigger"
          onClick={() => setSettingsOpen(true)}
          aria-label="Session settings"
        >
          <GearIcon />
        </button>

        <h1 className="app-title">Meal Match</h1>
        {deckError && <p className="form-error">{deckError}</p>}
        <button type="button" className="btn btn-primary" onClick={handleStart} disabled={building}>
          {building ? 'Starting…' : 'Start swiping'}
        </button>
        <button type="button" className="btn btn-restart" onClick={onExit}>
          Back to home
        </button>

        {settingsOpen && (
          <Modal title="Session settings" onClose={() => setSettingsOpen(false)}>
            <SwipeSettings settings={settings} onChange={setSettings} disabled={building} />
          </Modal>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      {!isFinished && <SoundToggle />}
      <h1 className="app-title">Meal Match</h1>

      {isFinished ? (
        <ResultScreen
          cuisines={deck}
          answers={answers}
          onRestart={handleRestart}
          secondaryAction={{ label: 'Back to home', onClick: onExit }}
        />
      ) : (
        <>
          <SwipeDeck deck={deck} index={index} onSwipe={handleSwipe} />
          <button type="button" className="btn btn-restart" onClick={onExit}>
            Back to home
          </button>
        </>
      )}
    </div>
  )
}

export default SoloSwipeApp
