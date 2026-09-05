import { useState } from 'react'
import RestaurantResults from './RestaurantResults'
import TieBreakScreen from './TieBreakScreen'

function ResultScreen({ cuisines, answers, onRestart, secondaryAction, renderResults }) {
  const liked = cuisines.filter((c) => answers[c.id])
  const [selectedWinner, setSelectedWinner] = useState(null)
  const [activeCuisine, setActiveCuisine] = useState(null)

  const winner = liked.length === 1 ? liked[0] : selectedWinner

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
      <div className="winner-emoji">{winner.emoji}</div>
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
        <h3>Nearby {displayedCuisine.name} spots</h3>
        {renderResults ? renderResults(displayedCuisine) : <RestaurantResults cuisine={displayedCuisine} />}
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
