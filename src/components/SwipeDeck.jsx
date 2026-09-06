import { useRef } from 'react'
import SwipeCard from './SwipeCard'
import DeckProgress from './DeckProgress'

// Renders the current interactive card plus up to two peeking behind it, so the deck reads
// as a tangible stack rather than one card popping in after another. Yes/No live here (not
// inside SwipeCard) since they sit outside the stack itself — they trigger the same fling
// animation as a drag-release via the ref SwipeCard exposes.
function SwipeDeck({ deck, index, onSwipe, teaseText }) {
  const cardRef = useRef(null)
  const current = deck[index]
  const behindOne = deck[index + 1]
  const behindTwo = deck[index + 2]

  return (
    <div className="card-wrap">
      <DeckProgress total={deck.length} index={index} />

      <div className="card-stack">
        {behindTwo && (
          <div className="card card-peek" style={{ '--peek-depth': 2 }} aria-hidden="true">
            <div className="card-emoji">{behindTwo.emoji}</div>
            <h2>{behindTwo.name}</h2>
            <p>{behindTwo.description}</p>
          </div>
        )}
        {behindOne && (
          <div className="card card-peek" style={{ '--peek-depth': 1 }} aria-hidden="true">
            <div className="card-emoji">{behindOne.emoji}</div>
            <h2>{behindOne.name}</h2>
            <p>{behindOne.description}</p>
          </div>
        )}
        <SwipeCard key={current.id} ref={cardRef} cuisine={current} onSwipe={onSwipe} teaseText={teaseText} />
      </div>

      <div className="buttons">
        <button type="button" className="btn btn-no" onClick={() => cardRef.current?.swipe('left')}>
          ✕ No
        </button>
        <button type="button" className="btn btn-yes" onClick={() => cardRef.current?.swipe('right')}>
          ✓ Yes
        </button>
      </div>
    </div>
  )
}

export default SwipeDeck
