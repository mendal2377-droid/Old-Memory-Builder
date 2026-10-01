import { useEffect, useMemo, useState } from 'react'
import { assets } from '../../data/assets'
import { isLighthouseCode } from '../../data/lighthouseCode'
import { useSceneStore } from '../../store/sceneStore'
import { ArchitectRoom } from './ArchitectRoom'

const DOOR_RANGE = 3.4

/**
 * The lighthouse door: a prompt when you stand beside it in Walk mode, a code
 * entry when you press E, and the room beyond once the code is right. A wrong
 * code gets no message -- the field just shudders and clears.
 */
export function LighthouseDoor() {
  const room = useSceneStore((s) => s.lighthouseRoom)
  const setRoom = useSceneStore((s) => s.setLighthouseRoom)
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const gameMode = useSceneStore((s) => s.gameMode)
  const walkPose = useSceneStore((s) => s.walkPose)
  const sceneObjects = useSceneStore((s) => s.sceneObjects)
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)

  const lighthouse = useMemo(() => {
    const found = sceneObjects.find(
      (o) => assets.find((a) => a.id === o.assetId)?.kind === 'lighthouse',
    )
    return found ? { x: found.position[0], z: found.position[2] } : null
  }, [sceneObjects])

  const canUse = cameraMode === 'walk' && gameMode === 'sandbox' && lighthouse !== null
  const isNear =
    canUse &&
    walkPose !== null &&
    Math.hypot(walkPose.x - lighthouse.x, walkPose.z - lighthouse.z) < DOOR_RANGE

  // Leaving Walk mode by any route closes whatever is open
  useEffect(() => {
    if (cameraMode !== 'walk' && room !== 'none') setRoom('none')
  }, [cameraMode, room, setRoom])

  useEffect(() => {
    if (room === 'code') setValue('')
  }, [room])

  useEffect(() => {
    if (!isNear || room !== 'none') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return
      // Without this the keystroke lands in the field that is about to open
      e.preventDefault()
      if (!e.repeat) setRoom('code')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isNear, room, setRoom])

  const submit = () => {
    if (isLighthouseCode(value)) {
      setRoom('inside')
      return
    }
    setValue('')
    setShake(true)
    window.setTimeout(() => setShake(false), 420)
  }

  return (
    <>
      {isNear && room === 'none' ? (
        <div className="lighthouse-prompt">Press E &mdash; the lighthouse door is locked</div>
      ) : null}

      {room === 'code' ? (
        <div className="lighthouse-code" role="dialog" aria-label="Lighthouse door">
          <form
            className={`lighthouse-code-box${shake ? ' is-shaking' : ''}`}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              autoFocus
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              maxLength={24}
              aria-label="Door code"
              onChange={(e) => setValue(e.target.value)}
              // Stop here so the walk controls never see these keys: the code
              // has W, A and D in it, and Escape would otherwise leave Walk mode.
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setRoom('none')
              }}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </form>
        </div>
      ) : null}

      {room === 'inside' ? <ArchitectRoom /> : null}
    </>
  )
}
