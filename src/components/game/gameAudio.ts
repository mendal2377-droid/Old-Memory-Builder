// Procedural sound effects for the Storm Game. A single shared AudioContext
// keeps rapid-fire cues (hammer strikes, chimes) from exhausting the browser's
// per-page context limit.

let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextClass) {
    return null
  }

  if (!sharedContext) {
    sharedContext = new AudioContextClass()
  }

  if (sharedContext.state === 'suspended') {
    void sharedContext.resume()
  }

  return sharedContext
}

interface ToneOptions {
  frequency: number
  at: number
  duration: number
  peak: number
  type?: OscillatorType
  slideTo?: number
}

function playTone(context: AudioContext, options: ToneOptions) {
  const { frequency, at, duration, peak, type = 'sine', slideTo } = options
  const start = context.currentTime + at
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)

  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(slideTo, 1),
      start + duration,
    )
  }

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

interface NoiseOptions {
  at: number
  duration: number
  peak: number
  filterType: BiquadFilterType
  frequency: number
  q?: number
}

function playNoise(context: AudioContext, options: NoiseOptions) {
  const { at, duration, peak, filterType, frequency, q = 1 } = options
  const start = context.currentTime + at
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const data = buffer.getChannelData(0)

  for (let index = 0; index < frameCount; index += 1) {
    const fade = 1 - index / frameCount
    data[index] = (Math.random() * 2 - 1) * fade * fade
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  filter.type = filterType
  filter.frequency.value = frequency
  filter.Q.value = q

  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)
  source.start(start)
  source.stop(start + duration + 0.02)
}

/** Short rising two-note chime that marks a checklist item turning green. */
function playTaskChime(context: AudioContext, at: number) {
  playTone(context, { frequency: 784, at, duration: 0.18, peak: 0.05 })
  playTone(context, { frequency: 1175, at: at + 0.11, duration: 0.3, peak: 0.045 })
}

/** Logs knocking together as an armful of firewood is gathered. */
export function playWoodCollected(isMuted: boolean) {
  if (isMuted) return
  const context = getContext()
  if (!context) return

  ;[0, 0.09, 0.19].forEach((offset, index) => {
    playTone(context, {
      frequency: 320 - index * 34,
      at: offset,
      duration: 0.12,
      peak: 0.06,
      type: 'triangle',
      slideTo: 150,
    })
    playNoise(context, {
      at: offset,
      duration: 0.07,
      peak: 0.05,
      filterType: 'bandpass',
      frequency: 1500,
      q: 1.4,
    })
  })

  playTaskChime(context, 0.34)
}

/** Hammer strikes driving planks back onto the bridge. */
export function playBridgeRepaired(isMuted: boolean) {
  if (isMuted) return
  const context = getContext()
  if (!context) return

  ;[0, 0.16, 0.32].forEach((offset) => {
    playNoise(context, {
      at: offset,
      duration: 0.1,
      peak: 0.09,
      filterType: 'bandpass',
      frequency: 1100,
      q: 0.8,
    })
    playTone(context, {
      frequency: 190,
      at: offset,
      duration: 0.15,
      peak: 0.07,
      type: 'sine',
      slideTo: 70,
    })
  })

  playTaskChime(context, 0.5)
}

/** Warm ascending arpeggio as the lighthouse lamp comes alive. */
export function playVictoryFanfare(isMuted: boolean) {
  if (isMuted) return
  const context = getContext()
  if (!context) return

  ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone(context, {
      frequency,
      at: index * 0.14,
      duration: 0.55,
      peak: 0.055,
      type: 'triangle',
    })
  })

  // Soft sustained pad underneath the arpeggio
  playTone(context, {
    frequency: 261.63,
    at: 0.1,
    duration: 1.6,
    peak: 0.035,
    type: 'sine',
  })
}

/** Low collapsing rumble when the storm wins. */
export function playDefeatRumble(isMuted: boolean) {
  if (isMuted) return
  const context = getContext()
  if (!context) return

  playNoise(context, {
    at: 0,
    duration: 2.2,
    peak: 0.12,
    filterType: 'lowpass',
    frequency: 220,
  })

  playTone(context, {
    frequency: 130,
    at: 0,
    duration: 1.8,
    peak: 0.07,
    type: 'sine',
    slideTo: 48,
  })
  playTone(context, {
    frequency: 98,
    at: 0.25,
    duration: 1.6,
    peak: 0.05,
    type: 'sine',
    slideTo: 40,
  })
}
