import { useState } from 'react'

function JoinGroupScreen({ onJoin, onBack }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) return

    setChecking(true)
    setError('')
    try {
      await onJoin(trimmedCode)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="join-screen">
      <h1 className="app-title">Join a group</h1>

      <form className="join-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="room-code-input"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Room code"
          autoFocus
          maxLength={6}
        />
        <button type="submit" className="btn btn-primary" disabled={checking || !code.trim()}>
          {checking ? 'Checking…' : 'Join'}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <button type="button" className="btn btn-restart" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

export default JoinGroupScreen
