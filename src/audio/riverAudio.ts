import { hollow } from '../data/hollow'
import { useSceneStore } from '../store/sceneStore'
import { riverBlobs } from '../components/scene/RiverBankDressing'
import { audioOut, getAudioContext, noiseSource } from './engine'

/**
 * The river, heard from where you stand.
 *
 * Loud when you are on the bridge, a murmur from the bank, nothing by the time
 * you are across the garden -- and it comes from the side the water is on, so
 * you can turn your head toward it. In the Hollow the water is dead and so is
 * the sound.
 */

/** Distance from a point to the nearest water, and the direction (world x, z) of it. */
export function nearestWater(x: number, z: number) {
  let best = Infinity
  let bx = 0
  let bz = 1
  for (const [cx, cz, w, l] of riverBlobs) {
    const dx = x - cx
    const dz = z - cz
    // How many "radii" out from the middle of the blob, in its own squashed space
    const r = Math.hypot(dx / w, dz / l)
    const edge = Math.max(0, r - 0.85) * ((w + l) / 2)
    if (edge < best) {
      best = edge
      const len = Math.hypot(cx - x, cz - z) || 1
      bx = (cx - x) / len
      bz = (cz - z) / len
    }
  }
  return { distance: best, dirX: bx, dirZ: bz }
}

/** 0..1 loudness for a given distance to the water. */
export function riverLoudness(distance: number) {
  return Math.exp(-distance / 5.5)
}

export function startRiverAudio(): (() => void) | null {
  const ctx = getAudioContext()
  if (!ctx) return null

  const out = ctx.createGain()
  out.gain.value = 0.0001
  const pan = ctx.createStereoPanner()
  out.connect(pan)
  pan.connect(audioOut())

  // Babble: bandpassed noise whose level swells slowly, like water lapping
  const babble = noiseSource(ctx, 4)
  const babbleFilter = ctx.createBiquadFilter()
  babbleFilter.type = 'bandpass'
  babbleFilter.frequency.value = 760
  babbleFilter.Q.value = 0.7
  const babbleGain = ctx.createGain()
  babbleGain.gain.value = 0.55
  babble.connect(babbleFilter)
  babbleFilter.connect(babbleGain)
  babbleGain.connect(out)
  babble.start()

  // Body: the low push of moving water
  const body = noiseSource(ctx, 4, true)
  const bodyFilter = ctx.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.value = 260
  const bodyGain = ctx.createGain()
  bodyGain.gain.value = 1.1
  body.connect(bodyFilter)
  bodyFilter.connect(bodyGain)
  bodyGain.connect(out)
  body.start()

  const swell = ctx.createOscillator()
  const swellDepth = ctx.createGain()
  swell.frequency.value = 0.19
  swellDepth.gain.value = 0.2
  swell.connect(swellDepth)
  swellDepth.connect(babbleGain.gain)
  swell.start()

  let lastDistance = 99
  const update = () => {
    const state = useSceneStore.getState()
    const pose = state.walkPose
    const t = ctx.currentTime
    let level = 0
    let panValue = 0
    if (state.cameraMode === 'walk' && state.lighthouseRoom !== 'inside' && pose) {
      const { distance, dirX, dirZ } = nearestWater(pose.x, pose.z)
      lastDistance = distance
      level = riverLoudness(distance) * 0.07 * (1 - hollow.amount)
      // Screen-right for a camera looking along (sin yaw, cos yaw)
      const rightX = -Math.cos(pose.yaw)
      const rightZ = Math.sin(pose.yaw)
      // Nearer water swings less: right on top of it, it is all around you
      const spread = Math.min(1, distance / 3 + 0.25)
      panValue = Math.max(-1, Math.min(1, (dirX * rightX + dirZ * rightZ) * spread))
    }
    out.gain.setTargetAtTime(Math.max(level, 0.0001), t, 0.15)
    pan.pan.setTargetAtTime(panValue, t, 0.12)
    // Further away, less of the top end gets through
    babbleFilter.frequency.setTargetAtTime(520 + 520 * riverLoudness(lastDistance), t, 0.2)
  }
  const timer = window.setInterval(update, 90)
  update()

  return () => {
    window.clearInterval(timer)
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1)
    window.setTimeout(() => {
      babble.stop()
      body.stop()
      swell.stop()
      out.disconnect()
      pan.disconnect()
    }, 500)
  }
}
