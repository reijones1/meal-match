function HomeScreen({ onCreateGroup, onJoinGroup, onPlaySolo, creating, createError }) {
  return (
    <div className="home-screen">
      <h1 className="app-title">Meal Match</h1>
      <p className="home-subtitle">Decide what to eat, together.</p>

      <div className="home-actions">
        <button type="button" className="btn btn-primary" onClick={onCreateGroup} disabled={creating}>
          {creating ? 'Creating…' : 'Create a group'}
        </button>
        <button type="button" className="btn" onClick={onJoinGroup} disabled={creating}>
          Join a group
        </button>
        <button type="button" className="btn" onClick={onPlaySolo} disabled={creating}>
          Play solo
        </button>
      </div>

      {createError && <p className="form-error">{createError}</p>}
    </div>
  )
}

export default HomeScreen
