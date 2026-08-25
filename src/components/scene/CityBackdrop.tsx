import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  type InstancedMesh,
} from 'three'

/**
 * Cyber City backdrop: a ring of neon towers around the horizon plus a glowing
 * ground grid. Both are unlit — they read as distant light sources rather than
 * geometry, which keeps them legible at every hour.
 */

const TOWER_COUNT = 130
// Pushed well back: at 33 units the towers walled in a 46-unit board
const RING_INNER = 58
const RING_OUTER = 110

/** Lit-window facade: dark slab with a scatter of glowing windows. */
let facadeCache: CanvasTexture | null = null
function getFacadeTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (facadeCache) return facadeCache

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#0a0714'
  ctx.fillRect(0, 0, 64, 128)

  // Restrained palette: mostly cool, a few warm accents
  const neon = ['#5fd2e8', '#8fa8d8', '#c98fd0', '#e8c98f', '#6f8fc8']
  const cols = 6
  const rows = 22
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (Math.random() > 0.3) continue
      ctx.fillStyle = neon[Math.floor(Math.random() * neon.length)]
      ctx.globalAlpha = 0.25 + Math.random() * 0.5
      ctx.fillRect(4 + c * 10, 4 + r * 5.5, 6, 3.2)
    }
  }
  ctx.globalAlpha = 1

  facadeCache = new CanvasTexture(canvas)
  facadeCache.wrapS = RepeatWrapping
  facadeCache.wrapT = RepeatWrapping
  facadeCache.needsUpdate = true
  return facadeCache
}

function CitySkyline() {
  const meshRef = useRef<InstancedMesh>(null)

  const geometry = useMemo(() => {
    const geo = new BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0) // base at origin so scale.y grows upward
    return geo
  }, [])

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: getFacadeTexture(),
        color: '#ffffff',
        toneMapped: false,
        fog: true,
      }),
    [],
  )

  const towers = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(TOWER_COUNT * 16)
    for (let i = 0; i < TOWER_COUNT; i += 1) {
      const angle = (i / TOWER_COUNT) * Math.PI * 2 + Math.random() * 0.12
      const radius = RING_INNER + Math.random() * (RING_OUTER - RING_INNER)
      // Nearer towers stay shorter so the skyline reads as depth, not a wall
      const depth = (radius - RING_INNER) / (RING_OUTER - RING_INNER)
      const height = 8 + Math.pow(Math.random(), 0.8) * (12 + depth * 30)
      const width = 4 + Math.random() * 6

      dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      dummy.rotation.set(0, -angle + (Math.random() - 0.5) * 0.5, 0)
      dummy.scale.set(width, height, width * (0.7 + Math.random() * 0.6))
      dummy.updateMatrix()
      dummy.matrix.toArray(matrices, i * 16)
    }
    return matrices
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new Matrix4()
    for (let i = 0; i < TOWER_COUNT; i += 1) {
      m.fromArray(towers, i * 16)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [towers])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, TOWER_COUNT]}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}

/** Slow blinking aircraft-warning lights on top of the tallest towers. */
function BeaconLights() {
  const meshRef = useRef<InstancedMesh>(null)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ff3b6b',
        transparent: true,
        opacity: 0.9,
        toneMapped: false,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const geometry = useMemo(() => new BoxGeometry(0.5, 0.5, 0.5), [])
  const count = 18

  const spots = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(count * 16)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const radius = RING_INNER + 8 + Math.random() * (RING_OUTER - RING_INNER - 12)
      const height = 24 + Math.random() * 26
      dummy.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
      dummy.scale.setScalar(0.8 + Math.random() * 0.8)
      dummy.updateMatrix()
      dummy.matrix.toArray(matrices, i * 16)
      phases[i] = Math.random() * Math.PI * 2
    }
    return { matrices, phases }
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new Matrix4()
    for (let i = 0; i < count; i += 1) {
      m.fromArray(spots.matrices, i * 16)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [spots])

  useFrame(({ clock }) => {
    // One shared pulse keeps this to a single uniform write
    material.opacity = 0.35 + Math.abs(Math.sin(clock.elapsedTime * 1.1)) * 0.6
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}

const gridVertex = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const gridFragment = /* glsl */ `
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  // Anti-aliased grid lines using screen-space derivatives
  float gridLine(vec2 p, float spacing, float thickness) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
    vec2 w = fwidth(p) * thickness;
    vec2 l = smoothstep(w, vec2(0.0), g);
    return max(l.x, l.y);
  }

  void main() {
    float fine = gridLine(vWorld, 2.0, 1.2);
    float major = gridLine(vWorld, 10.0, 2.0);

    // A slow pulse travelling outward from the centre
    float dist = length(vWorld);
    float pulse = 0.5 + 0.5 * sin(dist * 0.28 - uTime * 1.4);

    vec3 col = mix(uColorA, uColorB, pulse);
    float alpha = fine * 0.28 + major * 0.55;
    alpha *= 1.0 - smoothstep(16.0, 30.0, dist);  // fade out past the board
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col * (0.7 + pulse * 0.6), alpha);
  }
`

function NeonGrid() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new Color('#2de3ff') },
          uColorB: { value: new Color('#ff3ec8') },
        },
        vertexShader: gridVertex,
        fragmentShader: gridFragment,
      }),
    [],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh
      position={[0, 0.045, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      raycast={() => null}
    >
      <planeGeometry args={[62, 62]} />
    </mesh>
  )
}

/** Drifting motes of light, like dust caught in the city's glow. */
function NeonHaze() {
  const dust = useMemo(() => {
    const count = 90
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() * 2 - 1) * 30
      positions[i * 3 + 1] = Math.random() * 12 + 0.5
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 30
    }
    return positions
  }, [])

  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[dust, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8de8ff"
        size={0.14}
        transparent
        opacity={0.5}
        depthWrite={false}
        sizeAttenuation
        blending={AdditiveBlending}
      />
    </points>
  )
}

export function CityBackdrop() {
  return (
    <group raycast={() => null}>
      <CitySkyline />
      <BeaconLights />
      <NeonGrid />
      <NeonHaze />
    </group>
  )
}
