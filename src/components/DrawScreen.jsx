// Shown when a swipe round ends without a strict majority — reuses TieBreakScreen's exact
// card/grid markup (see App.css's .tie-* rules) so this reads as the same flow, just with a
// different pair of actions: a rematch round with just these cuisines, or skip straight to
// the existing manual tie-break picker.
function DrawScreen({ cuisines, interactive, breaking, onBreakTie, onSkip }) {
  return (
    <div className="tie-break">
      <p className="results-label">It's a draw! These tied for the top vote:</p>

      <div className="tie-grid">
        {cuisines.map((c) => (
          <div key={c.id} className="tie-card tie-card-static">
            <div className="tie-emoji">{c.emoji}</div>
            <div className="tie-name">{c.name}</div>
          </div>
        ))}
      </div>

      {interactive ? (
        <>
          <button type="button" className="btn btn-primary" onClick={onBreakTie} disabled={breaking}>
            {breaking ? 'Starting rematch…' : 'Break the tie'}
          </button>
          <button type="button" className="btn btn-restart" onClick={onSkip} disabled={breaking}>
            Skip and decide now
          </button>
        </>
      ) : (
        <p className="restaurant-status">Waiting for the host to break the tie…</p>
      )}
    </div>
  )
}

export default DrawScreen
