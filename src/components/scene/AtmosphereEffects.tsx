import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  CanvasTexture,
  Color,
  Fog,
  ShaderMaterial,
  Vector2,
  type AmbientLight,
  type DirectionalLight,
  type Group,
  type HemisphereLight,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type LineSegments,
  type Points,
  type PointLight,
  type Texture,
  type Vector3Tuple,
} from 'three'
import {
  createAtmosphereSample,
  representativePreset,
  sampleAtmosphere,
} from '../../data/atmosphere'
import { getWindVector, updateWind } from '../../data/wind'
import { useSceneStore } from '../../store/sceneStore'
import type { AtmospherePreset } from '../../types/scene'

interface AtmosphereConfig {
  background: string
  skyTop: string
  skyBottom: string
  ambientIntensity: number
  skyFillColor: string
  groundFillColor: string
  skyFillIntensity: number
  directionalColor: string
  directionalIntensity: number
  directionalPosition: Vector3Tuple
  sound: 'morning' | 'sunset' | 'lightRain' | 'heavyRain' | 'snow' | 'night'
  fog?: {
    color: string
    near: number
    far: number
  }
}

const atmosphereConfigs: Record<AtmospherePreset, AtmosphereConfig> = {
  'Clear Morning': {
    background: '#f8f0df',
    skyTop: '#acd7f4',
    skyBottom: '#fff3d3',
    ambientIntensity: 0.58,
    skyFillColor: '#b7dcff',
    groundFillColor: '#efe0bf',
    skyFillIntensity: 0.72,
    directionalColor: '#ffe2a8',
    directionalIntensity: 2.05,
    directionalPosition: [-8, 9, 7],
    sound: 'morning',
    fog: { color: '#f7e8cf', near: 34, far: 112 },
  },
  Sunset: {
    background: '#e58d68',
    skyTop: '#8e536d',
    skyBottom: '#ffbd72',
    ambientIntensity: 0.36,
    skyFillColor: '#a5b7df',
    groundFillColor: '#c18d62',
    skyFillIntensity: 0.48,
    directionalColor: '#ffb35f',
    directionalIntensity: 2.25,
    directionalPosition: [-18, 3.1, -12],
    sound: 'sunset',
    fog: { color: '#dea074', near: 26, far: 105 },
  },
  'Rainy Day': {
    background: '#9eaab5',
    skyTop: '#8794a0',
    skyBottom: '#bec7ce',
    ambientIntensity: 0.55,
    skyFillColor: '#c6d1d8',
    groundFillColor: '#88939b',
    skyFillIntensity: 0.42,
    directionalColor: '#d6dde5',
    directionalIntensity: 0.8,
    directionalPosition: [3, 8, 5],
    sound: 'lightRain',
    fog: { color: '#a9b4be', near: 12, far: 70 },
  },
  'Heavy Rain': {
    background: '#59636f',
    skyTop: '#434c58',
    skyBottom: '#7d8892',
    ambientIntensity: 0.34,
    skyFillColor: '#8d99a5',
    groundFillColor: '#545f68',
    skyFillIntensity: 0.3,
    directionalColor: '#aeb8c3',
    directionalIntensity: 0.48,
    directionalPosition: [2, 7, 4],
    sound: 'heavyRain',
    fog: { color: '#626d78', near: 6, far: 42 },
  },
  'Snowy Day': {
    background: '#dce8ef',
    skyTop: '#cadce9',
    skyBottom: '#f2f7f7',
    ambientIntensity: 0.8,
    skyFillColor: '#dcefff',
    groundFillColor: '#d7e3e8',
    skyFillIntensity: 0.48,
    directionalColor: '#d8ecff',
    directionalIntensity: 0.9,
    directionalPosition: [2, 8, 5],
    sound: 'snow',
    fog: { color: '#e8f1f4', near: 8, far: 62 },
  },
  'Summer Night': {
    background: '#172033',
    skyTop: '#0b1730',
    skyBottom: '#263f72',
    ambientIntensity: 0.38,
    skyFillColor: '#314f86',
    groundFillColor: '#111827',
    skyFillIntensity: 0.18,
    directionalColor: '#b5cffd',
    directionalIntensity: 0.62,
    directionalPosition: [-4, 8, -3],
    sound: 'night',
    fog: { color: '#223452', near: 16, far: 92 },
  },
}

function connectNoise(
  audioContext: AudioContext,
  gain: GainNode,
  volume: number,
  filterFrequency: number,
) {
  const bufferSize = audioContext.sampleRate * 2
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const output = buffer.getChannelData(0)

  for (let index = 0; index < bufferSize; index += 1) {
    output[index] = (Math.random() * 2 - 1) * volume
  }

  const source = audioContext.createBufferSource()
  const filter = audioContext.createBiquadFilter()
  source.buffer = buffer
  source.loop = true
  filter.type = 'lowpass'
  filter.frequency.value = filterFrequency
  source.connect(filter)
  filter.connect(gain)
  source.start()

  return () => {
    source.stop()
    source.disconnect()
    filter.disconnect()
  }
}

function connectTone(
  audioContext: AudioContext,
  gain: GainNode,
  frequency: number,
  type: OscillatorType = 'sine',
) {
  const oscillator = audioContext.createOscillator()
  oscillator.type = type
  oscillator.frequency.value = frequency
  oscillator.connect(gain)
  oscillator.start()

  return () => {
    oscillator.stop()
    oscillator.disconnect()
  }
}

function connectPulseTone(
  audioContext: AudioContext,
  gain: GainNode,
  frequency: number,
  intervalMs: number,
  duration: number,
  type: OscillatorType = 'sine',
) {
  const playPulse = () => {
    const oscillator = audioContext.createOscillator()
    const pulseGain = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.25, now + duration)
    pulseGain.gain.setValueAtTime(0.0001, now)
    pulseGain.gain.exponentialRampToValueAtTime(0.04, now + duration * 0.2)
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(pulseGain)
    pulseGain.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  playPulse()
  const interval = window.setInterval(playPulse, intervalMs)

  return () => {
    window.clearInterval(interval)
  }
}

function useAtmosphereSound(preset: AtmospherePreset, isMuted: boolean) {
  useEffect(() => {
    if (isMuted || typeof window === 'undefined') {
      return
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    const audioContext = new AudioContextClass()
    const config = atmosphereConfigs[preset]
    const gain = audioContext.createGain()
    gain.gain.value =
      config.sound === 'heavyRain'
        ? 0.065
        : config.sound === 'lightRain'
          ? 0.038
          : config.sound === 'snow'
            ? 0.018
            : 0.012
    gain.connect(audioContext.destination)
    const cleanupNodes: Array<() => void> = []

    if (config.sound === 'morning') {
      cleanupNodes.push(connectTone(audioContext, gain, 220))
      cleanupNodes.push(connectNoise(audioContext, gain, 0.035, 760))
      cleanupNodes.push(connectPulseTone(audioContext, gain, 1180, 3400, 0.24))
      cleanupNodes.push(connectPulseTone(audioContext, gain, 1550, 5200, 0.18))
    } else if (config.sound === 'sunset') {
      cleanupNodes.push(connectNoise(audioContext, gain, 0.045, 680))
      cleanupNodes.push(connectTone(audioContext, gain, 165))
      cleanupNodes.push(connectPulseTone(audioContext, gain, 720, 4300, 0.16, 'triangle'))
    } else if (config.sound === 'lightRain') {
      cleanupNodes.push(connectNoise(audioContext, gain, 0.18, 1100))
    } else if (config.sound === 'heavyRain') {
      cleanupNodes.push(connectNoise(audioContext, gain, 0.34, 850))
      cleanupNodes.push(connectTone(audioContext, gain, 58, 'triangle'))
      cleanupNodes.push(connectNoise(audioContext, gain, 0.16, 260))
    } else if (config.sound === 'snow') {
      cleanupNodes.push(connectNoise(audioContext, gain, 0.09, 520))
      cleanupNodes.push(connectTone(audioContext, gain, 96))
    } else if (config.sound === 'night') {
      cleanupNodes.push(connectTone(audioContext, gain, 130))
      cleanupNodes.push(connectTone(audioContext, gain, 910, 'triangle'))
      cleanupNodes.push(connectPulseTone(audioContext, gain, 760, 850, 0.08, 'square'))
      cleanupNodes.push(connectPulseTone(audioContext, gain, 190, 4600, 0.2, 'sine'))
    } else {
      cleanupNodes.push(
        connectTone(audioContext, gain, config.sound === 'sunset' ? 165 : 220),
      )
    }

    void audioContext.resume()

    return () => {
      cleanupNodes.forEach((cleanup) => cleanup())
      gain.disconnect()
      void audioContext.close()
    }
  }, [isMuted, preset])
}

// A soft round sprite so points render as gentle circles, not squares.
let softSpriteCache: CanvasTexture | null = null
function getSoftSprite(): Texture | null {
  if (typeof document === 'undefined') return null
  if (softSpriteCache) return softSpriteCache
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.28)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  softSpriteCache = new CanvasTexture(canvas)
  softSpriteCache.needsUpdate = true
  return softSpriteCache
}

// A soft snowflake with faint six-point structure.
let snowflakeCache: CanvasTexture | null = null
function getSnowflakeSprite(): Texture | null {
  if (typeof document === 'undefined') return null
  if (snowflakeCache) return snowflakeCache
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // Soft glow core
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  glow.addColorStop(0, 'rgba(255,255,255,0.95)')
  glow.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 64, 64)
  // Six faint arms for crystalline hint
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(32, 32)
    ctx.lineTo(32 + Math.cos(angle) * 22, 32 + Math.sin(angle) * 22)
    ctx.stroke()
  }
  snowflakeCache = new CanvasTexture(canvas)
  snowflakeCache.needsUpdate = true
  return snowflakeCache
}

const windScratch = new Vector2()

function WeatherParticles({
  kind,
  density,
  fallSpeed,
  windDrift = 0.018,
  area = 58,
  height = 16,
  size,
}: {
  kind: 'rain' | 'snow'
  density: number
  fallSpeed: number
  windDrift?: number
  area?: number
  height?: number
  size?: number
}) {
  const pointsRef = useRef<Points>(null)
  const { positions, velocities } = useMemo(() => {
    const count = density
    const nextPositions = new Float32Array(count * 3)
    const nextVelocities = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * area - area / 2
      nextPositions[index * 3 + 1] = Math.random() * height + 3
      nextPositions[index * 3 + 2] = Math.random() * area - area / 2
      nextVelocities[index] =
        kind === 'rain'
          ? Math.random() * fallSpeed + fallSpeed
          : Math.random() * fallSpeed + fallSpeed * 0.55
    }

    return { positions: nextPositions, velocities: nextVelocities }
  }, [area, density, fallSpeed, height, kind])

  useFrame(({ clock }) => {
    const geometry = pointsRef.current?.geometry
    const positionAttribute = geometry?.getAttribute('position') as
      | BufferAttribute
      | undefined

    if (!positionAttribute) {
      return
    }

    // Precipitation leans with the shared wind, so gusts slant the whole sky
    const wind = getWindVector(windScratch)
    const lean = kind === 'snow' ? 0.055 : 0.09

    for (let index = 0; index < velocities.length; index += 1) {
      const xIndex = index * 3
      const yIndex = index * 3 + 1
      const zIndex = index * 3 + 2
      // Snow also flutters on its own; rain falls straight but for the wind
      const flutter =
        kind === 'snow'
          ? Math.sin(clock.elapsedTime * 0.75 + index * 1.71) * 0.008
          : 0

      positionAttribute.array[yIndex] -= velocities[index]
      positionAttribute.array[xIndex] += wind.x * lean + flutter + windDrift * 0.25
      positionAttribute.array[zIndex] += wind.y * lean

      if (positionAttribute.array[yIndex] < 0.05) {
        positionAttribute.array[yIndex] = Math.random() * height * 0.55 + height * 0.55
        positionAttribute.array[xIndex] = Math.random() * area - area / 2
        positionAttribute.array[zIndex] = Math.random() * area - area / 2
      }
    }

    positionAttribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={kind === 'snow' ? '#ffffff' : '#dbe7f1'}
        map={kind === 'snow' ? getSnowflakeSprite() : undefined}
        size={size ?? (kind === 'snow' ? 0.16 : 0.075)}
        transparent
        opacity={kind === 'snow' ? 0.9 : windDrift > 0.02 ? 0.74 : 0.62}
        depthWrite={false}
        sizeAttenuation={kind === 'snow'}
        blending={kind === 'snow' ? undefined : AdditiveBlending}
      />
    </points>
  )
}

function SunAirParticles({ preset }: { preset: 'Clear Morning' | 'Sunset' }) {
  const pointsRef = useRef<Points>(null)
  const { positions, phases } = useMemo(() => {
    const count = preset === 'Sunset' ? 80 : 110
    const nextPositions = new Float32Array(count * 3)
    const nextPhases = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 46 - 23
      nextPositions[index * 3 + 1] = Math.random() * 4.2 + 0.8
      nextPositions[index * 3 + 2] = Math.random() * 46 - 23
      nextPhases[index] = Math.random() * Math.PI * 2
    }

    return { positions: nextPositions, phases: nextPhases }
  }, [preset])

  useFrame(({ clock }) => {
    const positionAttribute = pointsRef.current?.geometry.getAttribute(
      'position',
    ) as BufferAttribute | undefined
    const material = pointsRef.current?.material as Material & {
      opacity?: number
    }

    if (!positionAttribute || !material) {
      return
    }

    for (let index = 0; index < phases.length; index += 1) {
      positionAttribute.array[index * 3] +=
        Math.sin(clock.elapsedTime * 0.22 + phases[index]) * 0.002
      positionAttribute.array[index * 3 + 1] +=
        Math.sin(clock.elapsedTime * 0.18 + phases[index]) * 0.0015
      positionAttribute.array[index * 3 + 2] +=
        Math.cos(clock.elapsedTime * 0.2 + phases[index]) * 0.002
    }

    material.opacity =
      preset === 'Sunset'
        ? 0.22 + Math.sin(clock.elapsedTime * 0.7) * 0.04
        : 0.18 + Math.sin(clock.elapsedTime * 0.55) * 0.03
    positionAttribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={preset === 'Sunset' ? '#ffd18a' : '#fff0b7'}
        size={preset === 'Sunset' ? 0.13 : 0.1}
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vColor = aColor;
    // Each star breathes at its own rate; never fully dark
    float pulse = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
    vTwinkle = 0.32 + 0.68 * pulse * pulse;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const starFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uOpacity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float dist = length(d);
    // Soft round core with a faint bloom
    float core = smoothstep(0.5, 0.08, dist);
    float bloom = smoothstep(0.5, 0.28, dist) * 0.4;
    float alpha = (core + bloom) * vTwinkle * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function StarField({ masterOpacity }: { masterOpacity?: () => number }) {
  const materialRef = useRef<ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const count = 620
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    const palette = [
      [1.0, 1.0, 1.0], // white
      [0.86, 0.92, 1.0], // cool blue
      [1.0, 0.94, 0.82], // warm
      [0.78, 0.88, 1.0], // deeper blue
    ]

    for (let i = 0; i < count; i += 1) {
      // Distribute across a dome so stars ring the horizon and fill overhead
      const azimuth = Math.random() * Math.PI * 2
      const elevation = Math.pow(Math.random(), 0.7) * (Math.PI * 0.5)
      const radius = 120 + Math.random() * 40
      const horizontal = Math.cos(elevation) * radius
      positions[i * 3] = Math.cos(azimuth) * horizontal
      positions[i * 3 + 1] = Math.sin(elevation) * radius + 6
      positions[i * 3 + 2] = Math.sin(azimuth) * horizontal

      // Most stars small and faint; a few are big and bright (near)
      const near = Math.random()
      sizes[i] = near > 0.94 ? 4.5 + Math.random() * 3.5 : 1.2 + Math.random() * 2.4
      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.6 + Math.random() * 2.6

      const [r, g, b] = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    return { positions, sizes, phases, speeds, colors }
  }, [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime
      if (masterOpacity) {
        materialRef.current.uniforms.uOpacity.value = masterOpacity()
      }
    }
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[geometry.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[geometry.phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[geometry.speeds, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[geometry.colors, 3]} />
      </bufferGeometry>
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  )
}

// A handful of slow shooting stars streaking across the night sky.
function ShootingStars() {
  const groupRef = useRef<Group>(null)
  const streaks = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, i) => ({
        delay: i * 6 + Math.random() * 5,
        period: 14 + Math.random() * 10,
        startX: -50 + Math.random() * 30,
        y: 30 + Math.random() * 20,
        z: -60 - Math.random() * 30,
        length: 8 + Math.random() * 6,
      })),
    [],
  )
  const meshRefs = useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    streaks.forEach((streak, i) => {
      const mesh = meshRefs.current[i]
      if (!mesh) return
      const local = (clock.elapsedTime - streak.delay) % streak.period
      const progress = local / 2.4 // streak crosses over ~2.4s
      const material = mesh.material as MeshBasicMaterial
      if (local < 0 || progress > 1) {
        material.opacity = 0
        return
      }
      mesh.position.set(
        streak.startX + progress * 70,
        streak.y - progress * 14,
        streak.z,
      )
      material.opacity = Math.sin(progress * Math.PI) * 0.85
    })
  })

  return (
    <group ref={groupRef}>
      {streaks.map((streak, i) => (
        <mesh
          key={`shooting-${i}`}
          ref={(m) => {
            meshRefs.current[i] = m
          }}
          rotation={[0, 0, -0.32]}
        >
          <planeGeometry args={[streak.length, 0.09]} />
          <meshBasicMaterial
            color="#eaf3ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

let moonFaceCache: CanvasTexture | null = null
function getMoonFace(): Texture | null {
  if (typeof document === 'undefined') return null
  if (moonFaceCache) return moonFaceCache
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // Pale lit disc with a soft terminator on the lower-left
  const base = ctx.createRadialGradient(52, 48, 8, 64, 64, 66)
  base.addColorStop(0, '#ffffff')
  base.addColorStop(0.55, '#f2f6ff')
  base.addColorStop(1, '#c9d6ef')
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(64, 64, 62, 0, Math.PI * 2)
  ctx.fill()
  // Craters / maria as soft grey blots
  const craters: Array<[number, number, number, number]> = [
    [48, 44, 12, 0.18],
    [82, 58, 9, 0.14],
    [60, 82, 14, 0.16],
    [40, 74, 7, 0.12],
    [90, 86, 6, 0.1],
    [70, 40, 5, 0.1],
  ]
  for (const [cx, cy, r, alpha] of craters) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(150,164,196,${alpha})`)
    g.addColorStop(1, 'rgba(150,164,196,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  moonFaceCache = new CanvasTexture(canvas)
  moonFaceCache.needsUpdate = true
  return moonFaceCache
}

function Fireflies() {
  const pointsRef = useRef<Points>(null)
  const { positions, phases } = useMemo(() => {
    const count = 70
    const nextPositions = new Float32Array(count * 3)
    const nextPhases = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 42 - 21
      nextPositions[index * 3 + 1] = Math.random() * 1.8 + 0.5
      nextPositions[index * 3 + 2] = Math.random() * 42 - 21
      nextPhases[index] = Math.random() * Math.PI * 2
    }

    return { positions: nextPositions, phases: nextPhases }
  }, [])

  useFrame(({ clock }) => {
    const positionAttribute = pointsRef.current?.geometry.getAttribute(
      'position',
    ) as BufferAttribute | undefined
    const material = pointsRef.current?.material as Material & {
      opacity?: number
    }

    if (!positionAttribute || !material) {
      return
    }

    for (let index = 0; index < phases.length; index += 1) {
      positionAttribute.array[index * 3] +=
        Math.sin(clock.elapsedTime * 0.55 + phases[index]) * 0.003
      positionAttribute.array[index * 3 + 1] +=
        Math.sin(clock.elapsedTime * 0.42 + phases[index]) * 0.002
      positionAttribute.array[index * 3 + 2] +=
        Math.cos(clock.elapsedTime * 0.5 + phases[index]) * 0.003
    }

    material.opacity = 0.52 + Math.sin(clock.elapsedTime * 1.8) * 0.18
    positionAttribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#fff2a8"
        map={getSoftSprite()}
        size={0.16}
        transparent
        opacity={0.72}
        depthWrite={false}
        sizeAttenuation
        blending={AdditiveBlending}
      />
    </points>
  )
}

function FallingLeaves({ color = '#d9793d', count = 95 }: { color?: string; count?: number }) {
  const pointsRef = useRef<Points>(null)
  const { positions, phases, speeds } = useMemo(() => {
    const nextPositions = new Float32Array(count * 3)
    const nextPhases = new Float32Array(count)
    const nextSpeeds = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 52 - 26
      nextPositions[index * 3 + 1] = Math.random() * 8 + 2
      nextPositions[index * 3 + 2] = Math.random() * 52 - 26
      nextPhases[index] = Math.random() * Math.PI * 2
      nextSpeeds[index] = Math.random() * 0.018 + 0.012
    }

    return { positions: nextPositions, phases: nextPhases, speeds: nextSpeeds }
  }, [count])

  useFrame(({ clock }) => {
    const positionAttribute = pointsRef.current?.geometry.getAttribute(
      'position',
    ) as BufferAttribute | undefined
    const material = pointsRef.current?.material as Material & {
      opacity?: number
    }

    if (!positionAttribute || !material) {
      return
    }

    for (let index = 0; index < phases.length; index += 1) {
      const xIndex = index * 3
      const yIndex = index * 3 + 1
      const zIndex = index * 3 + 2
      const wave = Math.sin(clock.elapsedTime * 0.72 + phases[index])

      positionAttribute.array[xIndex] += wave * 0.006
      positionAttribute.array[yIndex] -= speeds[index]
      positionAttribute.array[zIndex] += Math.cos(clock.elapsedTime * 0.48 + phases[index]) * 0.004

      if (positionAttribute.array[yIndex] < 0.08) {
        positionAttribute.array[xIndex] = Math.random() * 52 - 26
        positionAttribute.array[yIndex] = Math.random() * 5 + 6
        positionAttribute.array[zIndex] = Math.random() * 52 - 26
      }
    }

    material.opacity = 0.28 + Math.sin(clock.elapsedTime * 0.6) * 0.05
    positionAttribute.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.13}
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </points>
  )
}

function playProceduralThunder(strength: 'soft' | 'heavy') {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext

  if (!AudioContextClass) {
    return
  }

  // Future swap point: replace this procedural rumble with /assets/audio/thunder.mp3.
  const audioContext = new AudioContextClass()
  const duration = strength === 'heavy' ? 3.4 : 2.2
  const gain = audioContext.createGain()
  const filter = audioContext.createBiquadFilter()
  const oscillator = audioContext.createOscillator()
  const bufferSize = audioContext.sampleRate * duration
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const output = buffer.getChannelData(0)
  const noise = audioContext.createBufferSource()
  const now = audioContext.currentTime

  for (let index = 0; index < bufferSize; index += 1) {
    const falloff = 1 - index / bufferSize
    output[index] = (Math.random() * 2 - 1) * falloff * 0.35
  }

  noise.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(strength === 'heavy' ? 120 : 180, now)
  filter.frequency.exponentialRampToValueAtTime(
    strength === 'heavy' ? 55 : 85,
    now + duration,
  )
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(strength === 'heavy' ? 42 : 62, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(
    strength === 'heavy' ? 0.18 : 0.07,
    now + 0.08,
  )
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  noise.connect(filter)
  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(audioContext.destination)
  noise.start(now)
  oscillator.start(now)
  noise.stop(now + duration)
  oscillator.stop(now + duration)

  window.setTimeout(() => {
    noise.disconnect()
    oscillator.disconnect()
    filter.disconnect()
    gain.disconnect()
    void audioContext.close()
  }, duration * 1000 + 150)
}

function LightningStorm({
  preset,
  isMuted,
}: {
  preset: 'Rainy Day' | 'Heavy Rain'
  isMuted: boolean
}) {
  const lightRef = useRef<PointLight>(null)
  const flashMeshRef = useRef<Mesh>(null)
  const flashIntensityRef = useRef(0)
  const flashOpacityRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const isHeavy = preset === 'Heavy Rain'
  // Final minute of the Storm Game: lightning closes in
  const isUrgent = useSceneStore(
    (state) => state.gameMode === 'playing' && state.gameTimeRemaining <= 60,
  )

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      timersRef.current = []
    }

    const addTimer = (callback: () => void, delay: number) => {
      const timerId = window.setTimeout(callback, delay)
      timersRef.current.push(timerId)
    }

    const triggerFlash = () => {
      const flickers = Math.random() > 0.38 ? 2 : 1
      const baseIntensity = isHeavy ? 4.8 : 2.1
      const baseOpacity = isHeavy ? 0.2 : 0.08

      for (let index = 0; index < flickers; index += 1) {
        addTimer(() => {
          flashIntensityRef.current = baseIntensity * (1 - index * 0.22)
          flashOpacityRef.current = baseOpacity * (1 - index * 0.2)
        }, index * (isHeavy ? 85 : 110))
      }

      if (!isMuted) {
        // Storm overhead in the final minute: thunder follows the flash closely
        const thunderDelay = isUrgent
          ? (Math.random() * 0.35 + 0.1) * 1000
          : (Math.random() * 1.6 + 0.4) * 1000

        addTimer(
          () => playProceduralThunder(isHeavy || isUrgent ? 'heavy' : 'soft'),
          thunderDelay,
        )
      }
    }

    const scheduleNext = () => {
      const minSeconds = isUrgent ? 2.5 : isHeavy ? 8 : 20
      const maxSeconds = isUrgent ? 6 : isHeavy ? 25 : 45
      const delay = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000

      addTimer(() => {
        triggerFlash()
        scheduleNext()
      }, delay)
    }

    // The storm announces itself the moment the final minute begins
    if (isUrgent) {
      addTimer(triggerFlash, 200)
    }

    scheduleNext()

    return clearTimers
  }, [isHeavy, isMuted, isUrgent])

  useFrame(({ clock }) => {
    if (!lightRef.current || !flashMeshRef.current) {
      return
    }

    const material = flashMeshRef.current.material as MeshBasicMaterial
    flashIntensityRef.current *= isHeavy ? 0.86 : 0.82
    flashOpacityRef.current *= isHeavy ? 0.84 : 0.8
    lightRef.current.intensity = flashIntensityRef.current
    material.opacity = flashOpacityRef.current
    flashMeshRef.current.lookAt(0, 18 + Math.sin(clock.elapsedTime * 0.1), 0)
  })

  return (
    <>
      <pointLight
        ref={lightRef}
        position={[0, 18, -8]}
        color="#dcecff"
        intensity={0}
        distance={90}
        decay={1.8}
      />
      <mesh ref={flashMeshRef} position={[0, 24, -46]}>
        <planeGeometry args={[130, 80]} />
        <meshBasicMaterial
          color="#dcecff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </>
  )
}

function WalkRainStreaks({ isHeavy }: { isHeavy: boolean }) {
  const { camera } = useThree()
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const linesRef = useRef<LineSegments>(null)
  const count = isHeavy ? 210 : 130
  const radius = 7
  const streakLen = isHeavy ? 0.52 : 0.34

  const { relX, relY, relZ, velocities, positions } = useMemo(() => {
    const rx = new Float32Array(count)
    const ry = new Float32Array(count)
    const rz = new Float32Array(count)
    const vel = new Float32Array(count)
    const pos = new Float32Array(count * 6)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius
      rx[i] = Math.cos(angle) * r
      ry[i] = Math.random() * 9 - 1
      rz[i] = Math.sin(angle) * r
      vel[i] = Math.random() * 0.11 + (isHeavy ? 0.13 : 0.07)
    }
    return { relX: rx, relY: ry, relZ: rz, velocities: vel, positions: pos }
  }, [count, isHeavy])

  useFrame(() => {
    const geo = linesRef.current?.geometry
    const attr = geo?.getAttribute('position') as BufferAttribute | undefined
    if (!attr) return
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z
    for (let i = 0; i < count; i += 1) {
      relY[i] -= velocities[i]
      if (relY[i] < -3) {
        const angle = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * radius
        relX[i] = Math.cos(angle) * r
        relY[i] = 5.5 + Math.random() * 3.5
        relZ[i] = Math.sin(angle) * r
      }
      attr.array[i * 6] = cx + relX[i]
      attr.array[i * 6 + 1] = cy + relY[i]
      attr.array[i * 6 + 2] = cz + relZ[i]
      attr.array[i * 6 + 3] = cx + relX[i] + (isHeavy ? 0.05 : 0.02)
      attr.array[i * 6 + 4] = cy + relY[i] - streakLen
      attr.array[i * 6 + 5] = cz + relZ[i]
    }
    attr.needsUpdate = true
  })

  if (cameraMode !== 'walk') return null

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#cce6f8"
        transparent
        opacity={isHeavy ? 0.54 : 0.38}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function WalkSnowDrift() {
  const { camera } = useThree()
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const pointsRef = useRef<Points>(null)
  const count = 150
  const radius = 6

  const { relX, relY, relZ, phases, velocities, positions } = useMemo(() => {
    const rx = new Float32Array(count)
    const ry = new Float32Array(count)
    const rz = new Float32Array(count)
    const ph = new Float32Array(count)
    const vel = new Float32Array(count)
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius
      rx[i] = Math.cos(angle) * r
      ry[i] = Math.random() * 8 - 1
      rz[i] = Math.sin(angle) * r
      ph[i] = Math.random() * Math.PI * 2
      vel[i] = Math.random() * 0.009 + 0.006
    }
    return { relX: rx, relY: ry, relZ: rz, phases: ph, velocities: vel, positions: pos }
  }, [])

  useFrame(({ clock }) => {
    const geo = pointsRef.current?.geometry
    const attr = geo?.getAttribute('position') as BufferAttribute | undefined
    if (!attr) return
    const cx = camera.position.x
    const cy = camera.position.y
    const cz = camera.position.z
    const t = clock.elapsedTime
    for (let i = 0; i < count; i += 1) {
      relY[i] -= velocities[i]
      relX[i] += Math.sin(t * 0.55 + phases[i]) * 0.005
      relZ[i] += Math.cos(t * 0.42 + phases[i]) * 0.004
      if (relY[i] < -2) {
        const angle = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * radius
        relX[i] = Math.cos(angle) * r
        relY[i] = 5 + Math.random() * 3
        relZ[i] = Math.sin(angle) * r
      }
      attr.array[i * 3] = cx + relX[i]
      attr.array[i * 3 + 1] = cy + relY[i]
      attr.array[i * 3 + 2] = cz + relZ[i]
    }
    attr.needsUpdate = true
  })

  if (cameraMode !== 'walk') return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f2f8ff"
        map={getSnowflakeSprite()}
        size={0.16}
        transparent
        opacity={0.9}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function GroundMist({ baseOpacity }: { baseOpacity: number }) {
  const cameraMode = useSceneStore((state) => state.cameraMode)
  const pointsRef = useRef<Points>(null)
  const { positions, phases } = useMemo(() => {
    const count = 220
    const nextPositions = new Float32Array(count * 3)
    const nextPhases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 62 - 31
      nextPositions[index * 3 + 1] = Math.random() * 0.9 + 0.05
      nextPositions[index * 3 + 2] = Math.random() * 62 - 31
      nextPhases[index] = Math.random() * Math.PI * 2
    }
    return { positions: nextPositions, phases: nextPhases }
  }, [])

  useFrame(({ clock }) => {
    const posAttr = pointsRef.current?.geometry.getAttribute('position') as
      | BufferAttribute
      | undefined
    const mat = pointsRef.current?.material as Material & { opacity?: number }
    if (!posAttr || !mat) return
    for (let index = 0; index < phases.length; index += 1) {
      posAttr.array[index * 3] +=
        Math.sin(clock.elapsedTime * 0.09 + phases[index]) * 0.003
      posAttr.array[index * 3 + 2] +=
        Math.cos(clock.elapsedTime * 0.07 + phases[index]) * 0.003
    }
    mat.opacity = baseOpacity * (0.82 + Math.sin(clock.elapsedTime * 0.28) * 0.18)
    posAttr.needsUpdate = true
  })

  if (cameraMode === 'walk') return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c8d8e8"
        size={3.2}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function RainSplashes({ density }: { density: number }) {
  const pointsRef = useRef<Points>(null)
  const { positions, phases, speeds } = useMemo(() => {
    const nextPositions = new Float32Array(density * 3)
    const nextPhases = new Float32Array(density)
    const nextSpeeds = new Float32Array(density)
    for (let index = 0; index < density; index += 1) {
      nextPositions[index * 3] = Math.random() * 54 - 27
      nextPositions[index * 3 + 1] = 0.04
      nextPositions[index * 3 + 2] = Math.random() * 54 - 27
      nextPhases[index] = Math.random() * Math.PI * 2
      nextSpeeds[index] = 2.5 + Math.random() * 2.5
    }
    return { positions: nextPositions, phases: nextPhases, speeds: nextSpeeds }
  }, [density])

  useFrame(({ clock }) => {
    const posAttr = pointsRef.current?.geometry.getAttribute('position') as
      | BufferAttribute
      | undefined
    if (!posAttr) return
    for (let index = 0; index < density; index += 1) {
      const cycle = (clock.elapsedTime * speeds[index] + phases[index]) % (Math.PI * 2)
      if (cycle < Math.PI) {
        posAttr.array[index * 3 + 1] = 0.04 + Math.sin(cycle) * 0.1
      } else {
        posAttr.array[index * 3 + 1] = -1
        posAttr.array[index * 3] = Math.random() * 54 - 27
        posAttr.array[index * 3 + 2] = Math.random() * 54 - 27
      }
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a8c8e0"
        size={0.15}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}

function FireflyGlow() {
  const pointsRef = useRef<Points>(null)
  const { positions, phases } = useMemo(() => {
    const count = 70
    const nextPositions = new Float32Array(count * 3)
    const nextPhases = new Float32Array(count)
    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 42 - 21
      nextPositions[index * 3 + 1] = Math.random() * 1.8 + 0.5
      nextPositions[index * 3 + 2] = Math.random() * 42 - 21
      nextPhases[index] = Math.random() * Math.PI * 2
    }
    return { positions: nextPositions, phases: nextPhases }
  }, [])

  useFrame(({ clock }) => {
    const posAttr = pointsRef.current?.geometry.getAttribute('position') as
      | BufferAttribute
      | undefined
    const mat = pointsRef.current?.material as Material & { opacity?: number }
    if (!posAttr || !mat) return
    for (let index = 0; index < phases.length; index += 1) {
      posAttr.array[index * 3] +=
        Math.sin(clock.elapsedTime * 0.55 + phases[index]) * 0.003
      posAttr.array[index * 3 + 1] +=
        Math.sin(clock.elapsedTime * 0.42 + phases[index]) * 0.002
      posAttr.array[index * 3 + 2] +=
        Math.cos(clock.elapsedTime * 0.5 + phases[index]) * 0.003
    }
    mat.opacity = 0.12 + Math.sin(clock.elapsedTime * 1.8) * 0.06
    posAttr.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffe878"
        map={getSoftSprite()}
        size={0.62}
        transparent
        opacity={0.14}
        depthWrite={false}
        sizeAttenuation
        blending={AdditiveBlending}
      />
    </points>
  )
}

// -- Unified atmosphere stage ------------------------------------------------
// One render path for every atmosphere. Time drives sky/sun/light; weather
// modulates it and adds particles. Both axes are always live.

const skyVertex = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const skyFragment = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  varying vec3 vWorldPos;
  void main() {
    float h = normalize(vWorldPos).y;
    float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(bottomColor, topColor, pow(t, 0.8)), 1.0);
  }
`

function AtmosphereStage() {
  const { scene, camera } = useThree()
  const sample = useMemo(() => createAtmosphereSample(), [])
  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          topColor: { value: new Color('#7db6e8') },
          bottomColor: { value: new Color('#fdf3d6') },
        },
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
      }),
    [],
  )
  const bgColor = useMemo(() => new Color('#eaf2f7'), [])
  const fog = useMemo(() => new Fog('#dfeef7', 34, 120), [])
  const ambientRef = useRef<AmbientLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const dirRef = useRef<DirectionalLight>(null)
  const sunRef = useRef<Group>(null)
  const sunRaysRef = useRef<Group>(null)
  const moonRef = useRef<Group>(null)
  // Tapered flare rays, jittered so the star never looks mechanical
  const sunRays = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        angle: (i / 12) * Math.PI * 2,
        length: 9 * (0.55 + Math.random() * 0.85),
      })),
    [],
  )
  const starOpacityRef = useRef(0)

  useEffect(() => {
    const prevBg = scene.background
    const prevFog = scene.fog
    scene.background = bgColor
    scene.fog = fog
    return () => {
      scene.background = prevBg
      scene.fog = prevFog
    }
  }, [scene, bgColor, fog])

  useFrame(() => {
    const state = useSceneStore.getState()
    sampleAtmosphere(
      state.timeOfDay,
      state.weather,
      state.weatherIntensity,
      state.worldStyle,
      sample,
    )

    bgColor.copy(sample.background)
    ;(skyMat.uniforms.topColor.value as Color).copy(sample.skyTop)
    ;(skyMat.uniforms.bottomColor.value as Color).copy(sample.skyBottom)
    fog.color.copy(sample.fogColor)
    fog.near = sample.fogNear
    fog.far = sample.fogFar

    if (ambientRef.current) {
      ambientRef.current.intensity = sample.ambientIntensity
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(sample.hemiSky)
      hemiRef.current.groundColor.copy(sample.hemiGround)
      hemiRef.current.intensity = sample.hemiIntensity
    }

    // Sun arcs east-to-west 06:00-18:00; the moon takes the opposite arc
    const hour = Math.max(0, Math.min(24, state.timeOfDay))
    const sunAngle = ((hour - 6) / 12) * Math.PI
    const sunPos: [number, number, number] = [
      Math.cos(sunAngle) * 34,
      Math.sin(sunAngle) * 24 + 1,
      -30,
    ]
    const moonHour = hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12
    const moonAngle = moonHour * Math.PI
    const moonPos: [number, number, number] = [
      Math.cos(moonAngle) * 34,
      Math.sin(moonAngle) * 24 + 1,
      -30,
    ]

    // Heavy cloud hides the disc entirely. The discs are also walk-mode only:
    // the build camera is orthographic, so distance does not shrink them and a
    // sun would draw hundreds of pixels wide across the diorama.
    const inWalk = state.cameraMode === 'walk'
    const discVisible = inWalk && sample.cloudiness < 0.55
    if (sunRef.current) {
      sunRef.current.position.set(...sunPos)
      sunRef.current.visible = sample.isDay && discVisible
      sunRef.current.lookAt(camera.position)
    }
    if (moonRef.current) {
      moonRef.current.position.set(...moonPos)
      moonRef.current.visible = !sample.isDay && discVisible
      moonRef.current.lookAt(camera.position)
    }
    if (dirRef.current) {
      const p = sample.isDay ? sunPos : moonPos
      dirRef.current.position.set(p[0], Math.max(p[1], 3), p[2])
      dirRef.current.color.copy(sample.sunColor)
      dirRef.current.intensity = sample.sunIntensity
    }

    if (sunRaysRef.current) {
      sunRaysRef.current.rotation.z = state.timeOfDay * 0.35
    }

    starOpacityRef.current = sample.starOpacity
  })

  return (
    <>
      <mesh renderOrder={-1000}>
        <sphereGeometry args={[140, 32, 16]} />
        <primitive object={skyMat} attach="material" />
      </mesh>
      <ambientLight ref={ambientRef} intensity={0.6} />
      <hemisphereLight ref={hemiRef} intensity={0.7} />
      <directionalLight
        ref={dirRef}
        position={[10, 20, -20]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00018}
        shadow-radius={6}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={0.5}
        shadow-camera-far={90}
      />
      <group ref={sunRef}>
        {/* Outer atmospheric bloom */}
        <mesh position={[0, 0, -0.06]} renderOrder={97}>
          <circleGeometry args={[6.2, 48]} />
          <meshBasicMaterial color="#ffcf7a" transparent opacity={0.1} depthWrite={false} depthTest={false} blending={AdditiveBlending} />
        </mesh>
        {/* Tapered flare rays, turning slowly through the day */}
        <group ref={sunRaysRef} position={[0, 0, -0.04]}>
          {sunRays.map((ray, index) => (
            <group key={`sun-ray-${index}`} rotation={[0, 0, ray.angle]}>
              <mesh position={[0, ray.length * 0.5 + 1.1, 0]} renderOrder={98}>
                <coneGeometry args={[0.5, ray.length, 3]} />
                <meshBasicMaterial color="#fff0c0" transparent opacity={0.2} depthWrite={false} depthTest={false} blending={AdditiveBlending} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Inner halo */}
        <mesh position={[0, 0, -0.02]} renderOrder={99}>
          <circleGeometry args={[2.9, 48]} />
          <meshBasicMaterial color="#ffdf9a" transparent opacity={0.4} depthWrite={false} depthTest={false} blending={AdditiveBlending} />
        </mesh>
        {/* Bright core */}
        <mesh renderOrder={100}>
          <circleGeometry args={[1.7, 48]} />
          <meshBasicMaterial color="#fff8dc" transparent opacity={0.97} depthWrite={false} depthTest={false} />
        </mesh>
      </group>
      <group ref={moonRef}>
        <mesh position={[0, 0, -0.06]}>
          <circleGeometry args={[7.5, 64]} />
          <meshBasicMaterial color="#7fa8ff" transparent opacity={0.07} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <mesh position={[0, 0, -0.03]}>
          <circleGeometry args={[4.2, 64]} />
          <meshBasicMaterial color="#aecbff" transparent opacity={0.15} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <mesh renderOrder={100}>
          <circleGeometry args={[2.4, 64]} />
          <meshBasicMaterial map={getMoonFace()} color="#ffffff" transparent opacity={0.97} depthWrite={false} depthTest={false} />
        </mesh>
      </group>
      <StarField masterOpacity={() => starOpacityRef.current} />
    </>
  )
}

/** Particles and local effects for the current weather, scaled by intensity. */
function WeatherLayer() {
  const weather = useSceneStore((state) => state.weather)
  const intensity = useSceneStore((state) => state.weatherIntensity)
  const timeOfDay = useSceneStore((state) => state.timeOfDay)
  const isMuted = useSceneStore((state) => state.isMuted)

  const k = Math.max(0.15, Math.min(1, intensity))
  const isDay = timeOfDay >= 6 && timeOfDay <= 18
  const scaled = (base: number) => Math.max(12, Math.round(base * k))

  if (weather === 'rain' || weather === 'storm') {
    const isHeavy = weather === 'storm'
    return (
      <>
        <WeatherParticles
          kind="rain"
          density={scaled(isHeavy ? 820 : 340)}
          fallSpeed={isHeavy ? 0.125 : 0.043}
          windDrift={isHeavy ? 0.05 : 0.012}
          area={isHeavy ? 78 : 68}
          height={isHeavy ? 20 : 18}
          size={isHeavy ? 0.095 : undefined}
        />
        <LightningStorm
          preset={isHeavy ? 'Heavy Rain' : 'Rainy Day'}
          isMuted={isMuted}
        />
        <GroundMist baseOpacity={(isHeavy ? 0.18 : 0.11) * k} />
        <RainSplashes density={scaled(isHeavy ? 200 : 90)} />
        <WalkRainStreaks isHeavy={isHeavy} />
      </>
    )
  }

  if (weather === 'snow') {
    return (
      <>
        <WeatherParticles
          kind="snow"
          density={scaled(340)}
          fallSpeed={0.011}
          area={78}
          height={20}
          size={0.12}
        />
        <WeatherParticles
          kind="snow"
          density={scaled(260)}
          fallSpeed={0.02}
          area={64}
          height={16}
          size={0.34}
        />
        <GroundMist baseOpacity={0.13 * k} />
        <WalkSnowDrift />
      </>
    )
  }

  if (weather === 'overcast') {
    return <GroundMist baseOpacity={0.1 * k} />
  }

  // Clear: sunlit motes and drifting leaves by day, fireflies and meteors at night
  return (
    <>
      {isDay ? (
        <>
          <SunAirParticles preset={timeOfDay >= 16 ? 'Sunset' : 'Clear Morning'} />
          <FallingLeaves
            color={timeOfDay >= 16 ? '#d9793d' : '#b4d46a'}
            count={60}
          />
        </>
      ) : (
        <>
          <ShootingStars />
          <Fireflies />
          <FireflyGlow />
        </>
      )}
    </>
  )
}

/** Advances the one shared wind that foliage and precipitation both read. */
function WindDriver() {
  useFrame(({ clock }) => {
    const state = useSceneStore.getState()
    updateWind(clock.elapsedTime, state.weather, state.weatherIntensity)
  })
  return null
}

export function AtmosphereEffects() {
  const isMuted = useSceneStore((state) => state.isMuted)
  const weather = useSceneStore((state) => state.weather)
  const timeOfDay = useSceneStore((state) => state.timeOfDay)
  const isDay = timeOfDay >= 6 && timeOfDay <= 18

  useAtmosphereSound(representativePreset(weather, isDay), isMuted)

  return (
    <>
      <WindDriver />
      <AtmosphereStage />
      <WeatherLayer />
    </>
  )
}
