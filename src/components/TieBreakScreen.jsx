function TieBreakScreen({ cuisines, onPick, interactive = true }) {
  function handleChooseForMe() {
    const pick = cuisines[Math.floor(Math.random() * cuisines.length)]
    onPick(pick)
  }

  return (
    <div className="tie-break">
      <p className="results-label">{interactive ? "It's a tie! Pick one:" : "It's a tie!"}</p>

      <div className="tie-grid">
        {cuisines.map((c) =>
          interactive ? (
            <button key={c.id} type="button" className="tie-card" onClick={() => onPick(c)}>
              <div className="tie-emoji">{c.emoji}</div>
              <div className="tie-name">{c.name}</div>
            </button>
          ) : (
            <div key={c.id} className="tie-card tie-card-static">
              <div className="tie-emoji">{c.emoji}</div>
              <div className="tie-name">{c.name}</div>
            </div>
          ),
        )}
      </div>

      {interactive ? (
        <button type="button" className="btn btn-choose-random" onClick={handleChooseForMe}>
          🎲 Choose for me
        </button>
      ) : (
        <p className="restaurant-status">Waiting for the host to break the tie…</p>
      )}
    </div>
  )
}

export default TieBreakScreen
