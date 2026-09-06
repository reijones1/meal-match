function DeckProgress({ total, index }) {
  const remaining = total - index

  return (
    <div className="deck-progress">
      <div className="deck-dots" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`deck-dot${i === index ? ' deck-dot-current' : ''}${i < index ? ' deck-dot-done' : ''}`}
          />
        ))}
      </div>
      <p className="deck-progress-label">{remaining} left</p>
    </div>
  )
}

export default DeckProgress
