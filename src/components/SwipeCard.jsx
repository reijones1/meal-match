import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { playSwipeSound, vibrateShort } from '../lib/feedback'

const SWIPE_THRESHOLD = 100
const EXIT_DURATION_MS = 230
const MAX_ROTATION_DEG = 18

// The interactive top card: drag physics, the YUM/NAH stamps, and the fling-off/spring-back
// exit animation. Exposes `swipe(direction)` via ref so the Yes/No buttons (rendered by the
// parent SwipeDeck, since they sit outside the card stack) can trigger the exact same exit
// sequence a drag-release does, instead of a separate instant/no-animation path.
const SwipeCard = forwardRef(function SwipeCard({ cuisine, onSwipe, teaseText }, ref) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [springBack, setSpringBack] = useState(false)
  const [exit, setExit] = useState(null) // { x, rotation } | null
  const startX = useRef(0)
  const exitTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(exitTimerRef.current), [])

  function startExit(direction) {
    if (exit) return
    playSwipeSound()
    vibrateShort()
    const flingX = direction === 'right' ? window.innerWidth + 200 : -(window.innerWidth + 200)
    const flingRotation = direction === 'right' ? 32 : -32
    setDragging(false)
    setSpringBack(false)
    setExit({ x: flingX, rotation: flingRotation })
    exitTimerRef.current = setTimeout(() => onSwipe(direction), EXIT_DURATION_MS)
  }

  useImperativeHandle(ref, () => ({ swipe: startExit }))

  function handlePointerDown(e) {
    if (exit) return
    setDragging(true)
    setSpringBack(false)
    startX.current = e.clientX
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Some browsers/input devices can reject capture for a given pointer id — the drag
      // still works fine without it, so this is never worth failing the whole gesture over.
    }
  }

  function handlePointerMove(e) {
    if (!dragging) return
    setDragX(e.clientX - startX.current)
  }

  function finishDrag() {
    if (!dragging) return
    setDragging(false)
    if (dragX > SWIPE_THRESHOLD) {
      startExit('right')
    } else if (dragX < -SWIPE_THRESHOLD) {
      startExit('left')
    } else {
      setSpringBack(true)
      setDragX(0)
    }
  }

  const rotation = exit ? exit.rotation : Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, dragX / 12))
  const x = exit ? exit.x : dragX
  const cardStyle = {
    transform: `translateX(${x}px) rotate(${rotation}deg)`,
    transition: exit
      ? `transform ${EXIT_DURATION_MS}ms cubic-bezier(0.4, 0, 0.7, 1)`
      : dragging
        ? 'none'
        : springBack
          ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
          : 'transform 0.2s ease',
  }

  const dragProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1)
  const yumOpacity = dragX > 0 ? dragProgress : 0
  const nahOpacity = dragX < 0 ? dragProgress : 0

  return (
    <div
      className="card"
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerLeave={finishDrag}
    >
      {teaseText && <div className="social-tease">{teaseText}</div>}

      <div
        className="badge badge-yes"
        style={{ opacity: yumOpacity, transform: `rotate(10deg) scale(${0.85 + 0.2 * yumOpacity})` }}
      >
        YUM
      </div>
      <div
        className="badge badge-no"
        style={{ opacity: nahOpacity, transform: `rotate(-10deg) scale(${0.85 + 0.2 * nahOpacity})` }}
      >
        NAH
      </div>

      <div className="card-emoji">{cuisine.emoji}</div>
      <h2>{cuisine.name}</h2>
      <p>{cuisine.description}</p>
    </div>
  )
})

export default SwipeCard
