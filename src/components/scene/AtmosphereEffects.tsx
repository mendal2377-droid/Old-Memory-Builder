import { useFrame, useThree } from '@react-three/fiber'
/* eslint-disable react-hooks/immutability, react-hooks/purity */

import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  Color,
  DoubleSide,
  Fog,
  type Group,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type LineSegments,
  type Points,
  type PointLight,
  type Vector3Tuple,
} from 'three'
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

function SkyGradient({ config }: { config: AtmosphereConfig }) {
  const topColor = useMemo(() => new Color(config.skyTop), [config.skyTop])
  const bottomColor = useMemo(
    () => new Color(config.skyBottom),
    [config.skyBottom],
  )

  return (
    <mesh scale={[1, 1, 1]} renderOrder={-1000}>
      <sphereGeometry args={[140, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        depthTest={false}
        uniforms={{
          topColor: { value: topColor },
          bottomColor: { value: bottomColor },
        }}
        vertexShader={`
          varying vec3 worldPosition;

          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            worldPosition = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 worldPosition;

          void main() {
            float h = normalize(worldPosition).y * 0.5 + 0.5;
            vec3 color = mix(bottomColor, topColor, smoothstep(0.1, 0.92, h));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  )
}

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

    for (let index = 0; index < velocities.length; index += 1) {
      const xIndex = index * 3
      const yIndex = index * 3 + 1
      const zIndex = index * 3 + 2
      const drift =
        kind === 'snow'
          ? Math.sin(clock.elapsedTime * 0.75 + index * 1.71) * 0.008
          : windDrift

      positionAttribute.array[yIndex] -= velocities[index]
      positionAttribute.array[xIndex] += drift
      if (kind === 'rain') {
        positionAttribute.array[zIndex] += windDrift * 0.24
      }

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
        size={size ?? (kind === 'snow' ? 0.16 : 0.075)}
        transparent
        opacity={kind === 'snow' ? 0.78 : windDrift > 0.02 ? 0.74 : 0.62}
        depthWrite={false}
        blending={kind === 'snow' ? undefined : AdditiveBlending}
      />
    </points>
  )
}

function SunDisc({
  position,
  coreRadius,
  haloRadius,
  glowRadius,
  rayLength,
  rayCount,
  coreColor,
  haloColor,
  rayColor,
  rotationSpeed = 0.02,
}: {
  position: [number, number, number]
  coreRadius: number
  haloRadius: number
  glowRadius: number
  rayLength: number
  rayCount: number
  coreColor: string
  haloColor: string
  rayColor: string
  rotationSpeed?: number
}) {
  const groupRef = useRef<Group>(null)
  const raysRef = useRef<Group>(null)
  const coreRef = useRef<Mesh>(null)

  useFrame(({ camera, clock }) => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position)
    }
    if (raysRef.current) {
      raysRef.current.rotation.z = clock.elapsedTime * rotationSpeed
    }
    if (coreRef.current) {
      const mat = coreRef.current.material as MeshBasicMaterial
      mat.opacity = 0.94 + Math.sin(clock.elapsedTime * 1.4) * 0.05
    }
  })

  const rays = useMemo(() => {
    const arr: Array<{ angle: number; length: number }> = []
    for (let i = 0; i < rayCount; i += 1) {
      const angle = (i / rayCount) * Math.PI * 2
      const lengthJitter = 0.55 + Math.random() * 0.85
      arr.push({ angle, length: rayLength * lengthJitter })
    }
    return arr
  }, [rayCount, rayLength])

  return (
    <group ref={groupRef} position={position}>
      {/* Outer atmospheric glow */}
      <mesh position={[0, 0, -0.06]} renderOrder={100}>
        <circleGeometry args={[glowRadius, 48]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.14}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Thin tapered flare rays — rotating */}
      <group ref={raysRef} position={[0, 0, -0.04]}>
        {rays.map((ray, index) => (
          <group key={`ray-${index}`} rotation={[0, 0, ray.angle]}>
            <mesh position={[0, ray.length * 0.5 + coreRadius * 0.7, 0]} renderOrder={101}>
              <coneGeometry args={[coreRadius * 0.28, ray.length, 3]} />
              <meshBasicMaterial
                color={rayColor}
                transparent
          opacity={0.11}
                depthWrite={false}
                depthTest={false}
                blending={AdditiveBlending}
              />
            </mesh>
          </group>
        ))}
      </group>
      {/* Inner halo */}
      <mesh position={[0, 0, -0.02]} renderOrder={102}>
        <circleGeometry args={[haloRadius, 48]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={0.32}
          depthWrite={false}
          depthTest={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Bright core disc */}
      <mesh ref={coreRef} renderOrder={103}>
        <circleGeometry args={[coreRadius, 48]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.96}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  )
}

function MorningSun() {
  return (
    <SunDisc
      position={[14, 14, -32]}
      coreRadius={1.8}
      haloRadius={3.4}
      glowRadius={9}
      rayLength={10}
      rayCount={8}
      coreColor="#fffbeb"
      haloColor="#ffe9a8"
      rayColor="#fff0c0"
      rotationSpeed={0.015}
    />
  )
}

function SunsetSun() {
  return (
    <SunDisc
      position={[-22, 5.5, -28]}
      coreRadius={2.6}
      haloRadius={5.0}
      glowRadius={13}
      rayLength={14}
      rayCount={9}
      coreColor="#fff1c0"
      haloColor="#ff9d52"
      rayColor="#ffb068"
      rotationSpeed={0.018}
    />
  )
}

function SunsetCrescentMoon() {
  const groupRef = useRef<Group>(null)

  useFrame(({ camera }) => {
    groupRef.current?.lookAt(camera.position)
  })

  return (
    <group ref={groupRef} position={[26, 22, 18]}>
      {/* Soft halo */}
      <mesh position={[0, 0, -0.04]}>
        <circleGeometry args={[2.2, 32]} />
        <meshBasicMaterial
          color="#e8d8ff"
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Bright moon disc */}
      <mesh>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial
          color="#fff6e0"
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>
    </group>
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

function Sunbeams({ preset }: { preset: 'Clear Morning' | 'Sunset' }) {
  const groupRef = useRef<Group>(null)
  const isSunset = preset === 'Sunset'

  useFrame(({ camera, clock }) => {
    groupRef.current?.lookAt(camera.position)

    if (groupRef.current) {
      groupRef.current.position.y =
        (isSunset ? 7.2 : 9.2) + Math.sin(clock.elapsedTime * 0.18) * 0.12
    }
  })

  return (
    <group
      ref={groupRef}
      position={isSunset ? [-12, 7.2, -15] : [-8, 9.2, -10]}
      rotation={[0, 0, isSunset ? -0.32 : -0.18]}
    >
      <mesh>
        <planeGeometry args={isSunset ? [13, 24] : [10, 18]} />
        <meshBasicMaterial
          color={isSunset ? '#ffcc80' : '#fff2b8'}
          transparent
          opacity={isSunset ? 0.045 : 0.035}
          depthWrite={false}
          depthTest={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function StarField() {
  const pointsRef = useRef<Points>(null)
  const positions = useMemo(() => {
    const count = 280
    const nextPositions = new Float32Array(count * 3)

    for (let index = 0; index < count; index += 1) {
      nextPositions[index * 3] = Math.random() * 120 - 60
      nextPositions[index * 3 + 1] = Math.random() * 32 + 18
      nextPositions[index * 3 + 2] = Math.random() * 120 - 60
    }

    return nextPositions
  }, [])

  useFrame(({ clock }) => {
    const material = pointsRef.current?.material as Material & {
      opacity?: number
    }

    if (material) {
      material.opacity = 0.58 + Math.sin(clock.elapsedTime * 1.3) * 0.18
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f7fbff"
        size={0.16}
        transparent
        opacity={0.68}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

function Moon() {
  const groupRef = useRef<Group>(null)

  useFrame(({ camera }) => {
    groupRef.current?.lookAt(camera.position)
  })

  return (
    <group ref={groupRef} position={[24, 18, -34]}>
      <mesh>
        <circleGeometry args={[3.6, 48]} />
        <meshBasicMaterial color="#e8f1ff" transparent opacity={0.95} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.015]}>
        <circleGeometry args={[5.4, 48]} />
        <meshBasicMaterial
          color="#9ebdff"
          transparent
          opacity={0.16}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.04]}>
        <circleGeometry args={[10, 48]} />
        <meshBasicMaterial
          color="#6e9fff"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
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
        size={0.12}
        transparent
        opacity={0.65}
        depthWrite={false}
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
        color="#e8f4ff"
        size={0.09}
        transparent
        opacity={0.78}
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
        size={0.58}
        transparent
        opacity={0.12}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

function AnimatedHeavyRainFog() {
  const { scene } = useThree()

  useFrame(({ clock }) => {
    if (!scene.fog) return
    const fog = scene.fog as Fog
    fog.near = 4 + Math.sin(clock.elapsedTime * 0.38) * 2.2
    fog.far = 36 + Math.sin(clock.elapsedTime * 0.26 + 1.4) * 7
  })

  return null
}

export function AtmosphereEffects() {
  const preset = useSceneStore((state) => state.atmospherePreset)
  const isMuted = useSceneStore((state) => state.isMuted)
  const config = atmosphereConfigs[preset]

  useAtmosphereSound(preset, isMuted)

  return (
    <>
      <color attach="background" args={[config.background]} />
      <SkyGradient config={config} />
      {config.fog ? (
        <fog
          attach="fog"
          args={[config.fog.color, config.fog.near, config.fog.far]}
        />
      ) : null}
      <ambientLight intensity={config.ambientIntensity} />
      <hemisphereLight
        color={config.skyFillColor}
        groundColor={config.groundFillColor}
        intensity={config.skyFillIntensity}
      />
      <directionalLight
        position={config.directionalPosition}
        color={config.directionalColor}
        intensity={config.directionalIntensity}
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
      {preset === 'Clear Morning' ? (
        <>
          <MorningSun />
          <Sunbeams preset="Clear Morning" />
          <SunAirParticles preset="Clear Morning" />
          <FallingLeaves color="#b4d46a" count={60} />
        </>
      ) : null}
      {preset === 'Sunset' ? (
        <>
          <SunsetSun />
          <Sunbeams preset="Sunset" />
          <SunsetCrescentMoon />
          <SunAirParticles preset="Sunset" />
          <FallingLeaves />
        </>
      ) : null}
      {preset === 'Rainy Day' ? (
        <>
          <WeatherParticles
            kind="rain"
            density={340}
            fallSpeed={0.043}
            windDrift={0.012}
            area={68}
            height={18}
          />
          <LightningStorm preset="Rainy Day" isMuted={isMuted} />
          <GroundMist baseOpacity={0.11} />
          <RainSplashes density={90} />
          <WalkRainStreaks isHeavy={false} />
        </>
      ) : null}
      {preset === 'Heavy Rain' ? (
        <>
          <WeatherParticles
            kind="rain"
            density={820}
            fallSpeed={0.125}
            windDrift={0.05}
            area={78}
            height={20}
            size={0.095}
          />
          <LightningStorm preset="Heavy Rain" isMuted={isMuted} />
          <GroundMist baseOpacity={0.18} />
          <RainSplashes density={200} />
          <AnimatedHeavyRainFog />
          <WalkRainStreaks isHeavy={true} />
        </>
      ) : null}
      {preset === 'Snowy Day' ? (
        <>
          <WeatherParticles
            kind="snow"
            density={430}
            fallSpeed={0.015}
            area={70}
            height={17}
            size={0.19}
          />
          <GroundMist baseOpacity={0.13} />
          <WalkSnowDrift />
        </>
      ) : null}
      {preset === 'Summer Night' ? (
        <>
          <StarField />
          <Moon />
          <Fireflies />
          <FireflyGlow />
        </>
      ) : null}
    </>
  )
}
