const MUTE_KEY = 'meal-match-sound-muted'

export function isSoundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false')
  } catch {
    // Worst case the preference just doesn't persist across sessions.
  }
}

export function vibrateShort() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(25)
  }
}

let audioCtx = null
function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

// A tiny synthesized "pop" (a quick descending blip) rather than an audio file — keeps the
// whole effect self-contained with nothing to fetch or bundle.
export function playSwipeSound() {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, now)
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.11)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.14)
}
