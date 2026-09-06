import { useMemo } from 'react'

const COLORS = ['var(--accent)', 'var(--gold)', 'var(--like)', 'var(--text-h)']
const PIECE_COUNT = 26

function Confetti() {
  // Randomized once per mount, not per render — a re-render mid-burst shouldn't reshuffle
  // pieces that are already mid-flight.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.15,
        duration: 0.7 + Math.random() * 0.4,
        drift: (Math.random() - 0.5) * 80,
        rotation: (Math.random() - 0.5) * 480,
      })),
    [],
  )

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotation}deg`,
          }}
        />
      ))}
    </div>
  )
}

export default Confetti
