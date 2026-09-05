import { useRef, useState } from 'react'

const SWIPE_THRESHOLD = 100

function SwipeCard({ cuisine, onSwipe }) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)

  function handlePointerDown(e) {
    setDragging(true)
    startX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragging) return
    setDragX(e.clientX - startX.current)
  }

  function finishDrag() {
    if (!dragging) return
    setDragging(false)
    if (dragX > SWIPE_THRESHOLD) {
      onSwipe('right')
    } else if (dragX < -SWIPE_THRESHOLD) {
      onSwipe('left')
    }
    setDragX(0)
  }

  const rotation = dragX / 20
  const cardStyle = {
    transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
    transition: dragging ? 'none' : 'transform 0.3s ease',
  }

  let badge = null
  if (dragX > 40) badge = <div className="badge badge-yes">YES</div>
  else if (dragX < -40) badge = <div className="badge badge-no">NO</div>

  return (
    <div className="card-wrap">
      <div
        className="card"
        style={cardStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerLeave={finishDrag}
      >
        {badge}
        <div className="card-emoji">{cuisine.emoji}</div>
        <h2>{cuisine.name}</h2>
        <p>{cuisine.description}</p>
      </div>

      <div className="buttons">
        <button type="button" className="btn btn-no" onClick={() => onSwipe('left')}>
          ✕ No
        </button>
        <button type="button" className="btn btn-yes" onClick={() => onSwipe('right')}>
          ✓ Yes
        </button>
      </div>
    </div>
  )
}

export default SwipeCard
