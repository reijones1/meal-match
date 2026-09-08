import { useEffect, useState } from 'react'
import RestaurantResults from './RestaurantResults'
import TieBreakScreen from './TieBreakScreen'
import Confetti from './Confetti'

// However the winner got decided — auto (only one liked), tie-break tap, or a group majority/
// rematch resolving elsewhere and flowing in via props — this is the one place they all land,
// so the celebration only needs to live here once.
const CELEBRATION_MS = 1100

function ResultScreen({ cuisines, answers, onRestart, secondaryAction, renderResults }) {
  const liked = cuisines.filter((c) => answers[c.id])
  const [selectedWinner, setSelectedWinner] = useState(null)
  const [activeCuisine, setActiveCuisine] = useState(null)
  const [celebrating, setCelebrating] = useState(false)

  const winner = liked.length === 1 ? liked[0] : selectedWinner

  // Depends on winner?.id (a stable primitive), not `winner` itself — a parent re-render can
  // hand this a new-but-equivalent winner object (GroupResultsScreen does this, e.g. while
  // recordSessionResult is still settling), and keying off the object reference would re-run
  // this on every such render, restarting the celebration each time instead of only once per
  // actual result. Deliberately no extra "already celebrated" ref guard on top of that — this
  // effect is naturally idempotent (mount, clean up, and run again always ends with exactly
  // one live timer that clears `celebrating`), and a ref guard here actually breaks that: it
  // survives the mount/cleanup/remount pair React's StrictMode does once in dev, so the
  // second run sees "already celebrated" and skips scheduling a replacement for the one the
  // cleanup just cancelled — leaving `celebrating` stuck true forever.
  useEffect(() => {
    if (!winner) return
    setCelebrating(true)
    const timer = setTimeout(() => setCelebrating(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [winner?.id])

  if (liked.length === 0) {
    return (
      <div className="results">
        <h2>You swiped no on everything. Try again?</h2>
        <button type="button" className="btn btn-restart" onClick={onRestart}>
          Restart
        </button>
        {secondaryAction && (
          <button type="button" className="btn btn-primary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </button>
        )}
      </div>
    )
  }

  if (liked.length > 1 && !winner) {
    return (
      <div className="results">
        <TieBreakScreen cuisines={liked} onPick={setSelectedWinner} />
        <button type="button" className="btn btn-restart" onClick={onRestart}>
          Restart
        </button>
      </div>
    )
  }

  const others = liked.filter((c) => c.id !== winner.id)
  const displayedCuisine = activeCuisine ?? winner

  return (
    <div className="results">
      <p className="results-label">Tonight's winner:</p>
      <div className="winner-celebrate">
        {celebrating && <Confetti />}
        <div className="winner-emoji">{winner.emoji}</div>
      </div>
      <h1>{winner.name}</h1>

      {others.length > 0 && (
        <div className="also-liked">
          <p>Also in the running — tap one to see its restaurants instead:</p>
          <div className="cuisine-chip-row">
            <button
              type="button"
              className={`pill-tab${displayedCuisine.id === winner.id ? ' pill-tab-active' : ''}`}
              onClick={() => setActiveCuisine(winner)}
            >
              {winner.emoji} {winner.name}
            </button>
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pill-tab${displayedCuisine.id === c.id ? ' pill-tab-active' : ''}`}
                onClick={() => setActiveCuisine(c)}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="restaurants-section">
        {celebrating ? (
          <p className="restaurant-status">🎉 Locking in {winner.name}…</p>
        ) : renderResults ? (
          renderResults(displayedCuisine)
        ) : (
          <>
            <h3>Nearby {displayedCuisine.name} spots</h3>
            <RestaurantResults cuisine={displayedCuisine} />
          </>
        )}
      </div>

      <button type="button" className="btn btn-restart" onClick={onRestart}>
        Restart
      </button>
      {secondaryAction && (
        <button type="button" className="btn btn-primary" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      )}
    </div>
  )
}

export default ResultScreen
