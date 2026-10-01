import { audioOut, getAudioContext, noiseSource, reverbIn } from './engine'

/**
 * The sound of the white room.
 *
 * Low and large: a slow drone with two notes beating against each other, the
 * faint air of a hundred screens, and now and then a tiny blip from one of
 * them. Footsteps ring off the glossy floor. All of it goes through the shared
 * reverb, which is what makes the room feel as big as it looks.
 */

export interface RoomAudio {
  footstep: () => void
  stop: () => void
}

export function startRoomAudio(): RoomAudio | null {
  const ctx = getAudioContext()
  if (!ctx) return null
  const out = audioOut()
  const verb = reverbIn()
  const stoppers: Array<() => void> = []

  const bed = ctx.createGain()
  bed.gain.setValueAtTime(0.0001, ctx.currentTime)
  // Fade in with the white-out rather than snapping on
  bed.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.2)
  bed.connect(out)
  const bedWet = ctx.createGain()
  bedWet.gain.value = 0.35
  bed.connect(bedWet)
  bedWet.connect(verb)

  // Drone: two sines a hair apart so they beat slowly, a triangle an octave up
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0.026
  const droneFilter = ctx.createBiquadFilter()
  droneFilter.type = 'lowpass'
  droneFilter.frequency.value = 320
  droneFilter.connect(droneGain)
  droneGain.connect(bed)
  for (const [freq, type, level] of [
    [55, 'sine', 1],
    [55.35, 'sine', 0.9],
    [82.4, 'sine', 0.5],
    [110.2, 'triangle', 0.22],
  ] as const) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.value = level
    osc.connect(g)
    g.connect(droneFilter)
    osc.start()
    stoppers.push(() => {
      osc.stop()
      osc.disconnect()
      g.disconnect()
    })
  }
  // The drone breathes, very slowly
  const lfo = ctx.createOscillator()
  const lfoDepth = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoDepth.gain.value = 0.007
  lfo.connect(lfoDepth)
  lfoDepth.connect(droneGain.gain)
  lfo.start()
  stoppers.push(() => {
    lfo.stop()
    lfo.disconnect()
    lfoDepth.disconnect()
  })

  // Air: the faint hiss of many screens
  const air = noiseSource(ctx, 3)
  const airHigh = ctx.createBiquadFilter()
  airHigh.type = 'highpass'
  airHigh.frequency.value = 1800
  const airLow = ctx.createBiquadFilter()
  airLow.type = 'lowpass'
  airLow.frequency.value = 6500
  const airGain = ctx.createGain()
  airGain.gain.value = 0.0045
  air.connect(airHigh)
  airHigh.connect(airLow)
  airLow.connect(airGain)
  airGain.connect(bed)
  air.start()
  stoppers.push(() => {
    air.stop()
    air.disconnect()
  })

  // Mains hum
  const hum = ctx.createOscillator()
  const humGain = ctx.createGain()
  hum.type = 'sine'
  hum.frequency.value = 100
  humGain.gain.value = 0.004
  hum.connect(humGain)
  humGain.connect(bed)
  hum.start()
  stoppers.push(() => {
    hum.stop()
    hum.disconnect()
    humGain.disconnect()
  })

  // Blips from the screens, scattered across the stereo field
  let blipTimer = 0
  const blip = () => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const pan = ctx.createStereoPanner()
    osc.type = Math.random() < 0.5 ? 'sine' : 'square'
    const f = 1100 + Math.random() * 3200
    osc.frequency.setValueAtTime(f, now)
    osc.frequency.setValueAtTime(f * (Math.random() < 0.5 ? 1.5 : 0.75), now + 0.035)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.011, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
    pan.pan.value = Math.random() * 2 - 1
    osc.connect(g)
    g.connect(pan)
    pan.connect(bed)
    osc.start(now)
    osc.stop(now + 0.09)
    blipTimer = window.setTimeout(blip, 500 + Math.random() * 2400)
  }
  blipTimer = window.setTimeout(blip, 900)

  // The door: a low swell as the white closes in
  const now = ctx.currentTime
  const swell = noiseSource(ctx, 2, true)
  const swellFilter = ctx.createBiquadFilter()
  swellFilter.type = 'bandpass'
  swellFilter.frequency.setValueAtTime(220, now)
  swellFilter.frequency.exponentialRampToValueAtTime(1400, now + 1.1)
  swellFilter.Q.value = 0.8
  const swellGain = ctx.createGain()
  swellGain.gain.setValueAtTime(0.0001, now)
  swellGain.gain.exponentialRampToValueAtTime(0.1, now + 0.5)
  swellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8)
  swell.connect(swellFilter)
  swellFilter.connect(swellGain)
  swellGain.connect(out)
  swellGain.connect(verb)
  swell.start(now)
  swell.stop(now + 2)

  const footstep = () => {
    const t = ctx.currentTime
    // A dry click for the heel and a short low knock for the weight behind it
    const click = noiseSource(ctx, 0.08)
    const clickFilter = ctx.createBiquadFilter()
    clickFilter.type = 'bandpass'
    clickFilter.frequency.value = 1900 + Math.random() * 500
    clickFilter.Q.value = 1.1
    const clickGain = ctx.createGain()
    clickGain.gain.setValueAtTime(0.06, t)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    click.connect(clickFilter)
    clickFilter.connect(clickGain)
    clickGain.connect(out)
    // Heavier into the reverb than the dry path: the floor is a hall
    const send = ctx.createGain()
    send.gain.value = 1.6
    clickGain.connect(send)
    send.connect(verb)
    click.start(t)
    click.stop(t + 0.08)

    const knock = ctx.createOscillator()
    const knockGain = ctx.createGain()
    knock.type = 'sine'
    knock.frequency.setValueAtTime(130, t)
    knock.frequency.exponentialRampToValueAtTime(58, t + 0.08)
    knockGain.gain.setValueAtTime(0.05, t)
    knockGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    knock.connect(knockGain)
    knockGain.connect(out)
    knock.start(t)
    knock.stop(t + 0.14)
    window.setTimeout(() => {
      clickGain.disconnect()
      send.disconnect()
      knockGain.disconnect()
    }, 400)
  }

  return {
    footstep,
    stop: () => {
      window.clearTimeout(blipTimer)
      const t = ctx.currentTime
      bed.gain.cancelScheduledValues(t)
      bed.gain.setValueAtTime(Math.max(bed.gain.value, 0.0001), t)
      bed.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      window.setTimeout(() => {
        stoppers.forEach((s) => s())
        bed.disconnect()
        bedWet.disconnect()
      }, 650)
    },
  }
}
