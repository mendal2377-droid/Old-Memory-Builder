import { useSceneStore } from '../store/sceneStore'

/**
 * One shared audio engine for the whole app.
 *
 * Sounds used to make an AudioContext of their own -- one per footstep, one per
 * memory point, one for the weather bed -- which browsers cap and which cost a
 * little every time. Everything now plays into a single master bus, which also
 * gives mute, a limiter, a shared reverb and one place to measure the level.
 *
 * Browsers only let a page make sound after the visitor has done something, so
 * the context is resumed on the first click or key press instead of at load.
 */

interface Engine {
  ctx: AudioContext
  master: GainNode
  reverb: ConvolverNode
  analyser: AnalyserNode
}

let engine: Engine | null = null
let gestureHooked = false

function impulseResponse(ctx: AudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      // Noise that dies away, brighter at the start: a large hard-walled room
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
    }
  }
  return buffer
}

function applyMute(muted: boolean) {
  if (!engine) return
  const { ctx, master } = engine
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05)
}

function hookGesture() {
  if (gestureHooked || typeof window === 'undefined') return
  gestureHooked = true
  const wake = () => {
    if (engine && engine.ctx.state === 'suspended') void engine.ctx.resume()
  }
  window.addEventListener('pointerdown', wake, true)
  window.addEventListener('keydown', wake, true)
}

function ensure(): Engine | null {
  if (engine) return engine
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  const ctx = new Ctor()
  const master = ctx.createGain()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -14
  limiter.ratio.value = 8
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  const reverb = ctx.createConvolver()
  reverb.buffer = impulseResponse(ctx, 2.6, 2.4)
  const wet = ctx.createGain()
  wet.gain.value = 0.9

  master.connect(limiter)
  reverb.connect(wet)
  wet.connect(limiter)
  limiter.connect(ctx.destination)
  limiter.connect(analyser)

  engine = { ctx, master, reverb, analyser }
  applyMute(useSceneStore.getState().isMuted)
  useSceneStore.subscribe((state, previous) => {
    if (state.isMuted !== previous.isMuted) applyMute(state.isMuted)
  })
  hookGesture()
  if (ctx.state === 'suspended') void ctx.resume()
  return engine
}

export function getAudioContext(): AudioContext | null {
  return ensure()?.ctx ?? null
}

/** Where every sound connects to. Valid once getAudioContext() has returned a context. */
export function audioOut(): AudioNode {
  const e = ensure()
  if (!e) throw new Error('Audio is not available')
  return e.master
}

/** Connect a source here as well for a large-room tail. */
export function reverbIn(): AudioNode {
  const e = ensure()
  if (!e) throw new Error('Audio is not available')
  return e.reverb
}

/** Root-mean-square of what is currently going to the speakers, 0..1. For tests and meters. */
export function audioLevel(): number {
  if (!engine) return 0
  const buf = new Float32Array(engine.analyser.fftSize)
  engine.analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function audioState(): AudioContextState | 'none' {
  return engine?.ctx.state ?? 'none'
}

/** A looping noise source: white, or brown-ish when `brown` is set. */
export function noiseSource(ctx: AudioContext, seconds = 4, brown = false) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}
