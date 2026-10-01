import { useEffect } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { startRiverAudio } from './riverAudio'

/**
 * Starts and stops the sounds that belong to where you are, not to a button:
 * the river while you walk. (The weather bed lives with the atmosphere, the
 * room's sound with the room.)
 */
export function AudioDirector() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const isMuted = useSceneStore((s) => s.isMuted)

  useEffect(() => {
    if (cameraMode !== 'walk' || isMuted) return
    return startRiverAudio() ?? undefined
  }, [cameraMode, isMuted])

  return null
}
