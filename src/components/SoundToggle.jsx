import { useState } from 'react'
import { isSoundMuted, setSoundMuted } from '../lib/feedback'
import { SoundOffIcon, SoundOnIcon } from './icons'

function SoundToggle() {
  const [muted, setMuted] = useState(isSoundMuted)

  function toggle() {
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
  }

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={toggle}
      aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
    >
      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
    </button>
  )
}

export default SoundToggle
