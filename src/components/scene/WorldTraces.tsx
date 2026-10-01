import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  ShaderMaterial,
  type Mesh,
  type MeshBasicMaterial,
} from 'three'
import { dawnFactor, traces } from '../../data/traces'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'
import { createObjectColliders, playerRadius } from './MemoryWalkCamera'
import { riverBlobs } from './RiverBankDressing'

/**
 * Two quiet traces of whatever is keeping the garden.
 *
 * Neither is labelled and neither is explained. Each has an ordinary first
 * reading -- a fairy ring, frost on the ground -- and only a second look shows
 * what it is actually drawing.
 */

type Loop = {
  /** Point on the loop for parameter a in [0,1). */
  at: (a: number) => [number, number]
  /** Rough length, used to choose how many dashes fit. */
  length: number
}

/** Dashed ribbons lying flat on the ground, merged into one geometry. */
function dashedGeometry(loops: Loop[], width: number) {
  const positions: number[] = []
  const y = 0.05
  const dash = 0.55
  const gap = 0.4

  for (const loop of loops) {
    const count = Math.max(8, Math.round(loop.length / (dash + gap)))
    const fill = dash / (dash + gap)
    for (let k = 0; k < count; k += 1) {
      const a0 = k / count
      const steps = 3
      for (let s = 0; s < steps; s += 1) {
        const u0 = a0 + (s / steps) * (fill / count)
        const u1 = a0 + ((s + 1) / steps) * (fill / count)
        const [x0, z0] = loop.at(u0)
        const [x1, z1] = loop.at(u1)
        const tx = x1 - x0
        const tz = z1 - z0
        const len = Math.hypot(tx, tz) || 1
        // Perpendicular to the direction of travel, in the ground plane
        const nx = (-tz / len) * (width / 2)
        const nz = (tx / len) * (width / 2)
        positions.push(
          x0 - nx, y, z0 - nz,
          x0 + nx, y, z0 + nz,
          x1 + nx, y, z1 + nz,
          x0 - nx, y, z0 - nz,
          x1 + nx, y, z1 + nz,
          x1 - nx, y, z1 - nz,
        )
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

const circle = (cx: number, cz: number, r: number): Loop => ({
  at: (a) => [cx + Math.cos(a * Math.PI * 2) * r, cz + Math.sin(a * Math.PI * 2) * r],
  length: Math.PI * 2 * r,
})

const ellipse = (cx: number, cz: number, rx: number, rz: number): Loop => ({
  at: (a) => [cx + Math.cos(a * Math.PI * 2) * rx, cz + Math.sin(a * Math.PI * 2) * rz],
  length: Math.PI * 2 * Math.sqrt((rx * rx + rz * rz) / 2),
})

/** Square loop, a in [0,1) walking round the four sides. */
const square = (half: number): Loop => ({
  at: (a) => {
    const side = Math.floor(a * 4) % 4
    const f = a * 4 - Math.floor(a * 4)
    const t = -half + f * half * 2
    if (side === 0) return [t, -half]
    if (side === 1) return [half, t]
    if (side === 2) return [-t, half]
    return [-half, -t]
  },
  length: half * 8,
})

/**
 * The walk code already computes a collision circle for every tree, house and
 * rock, plus the ellipses the river blocks you with and the edge of the
 * walkable square. Over there, those are drawn on the ground -- exactly as the
 * game sees them.
 */
export function HollowHitboxes() {
  const sceneObjects = useSceneStore((s) => s.sceneObjects)
  const meshRef = useRef<Mesh>(null)

  const geometry = useMemo(() => {
    const loops: Loop[] = []
    for (const c of createObjectColliders(sceneObjects)) {
      // What actually stops you is the collider plus your own radius
      loops.push(circle(c.position.x, c.position.z, c.radius + playerRadius))
    }
    for (const [cx, cz, w, l] of riverBlobs) {
      // isInRiverbankWater tests dx^2 + dz^2 < 0.72
      const k = Math.sqrt(0.72)
      loops.push(ellipse(cx, cz, w * k, l * k))
    }
    loops.push(square(19))
    return dashedGeometry(loops, 0.085)
  }, [sceneObjects])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const h = hollow.amount
    // Only present once you are well across, and never at full strength
    const a = Math.max(0, (h - 0.35) / 0.65) * 0.3 * traces.ringBoost
    mesh.visible = a > 0.003
    ;(mesh.material as MeshBasicMaterial).opacity = Math.min(1, a)
  })

  return (
    <mesh ref={meshRef} geometry={geometry} visible={false} raycast={() => null} renderOrder={4}>
      <meshBasicMaterial
        color="#dfe6ea"
        transparent
        opacity={0}
        side={DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
      />
    </mesh>
  )
}

const gridVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const gridFragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vWorld;

  float lines(vec2 p, float cell) {
    vec2 c = p / cell;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    // A perfect lattice reads as a grid the instant you see it. Frost does not
    // form evenly, so wobble the lines a little and let patches of them drop out.
    vec2 q = p + vec2(noise(p * 0.6), noise(p * 0.6 + 9.0)) * 0.5;
    float fine = lines(q, 2.0);
    float major = lines(q, 10.0);
    float line = max(fine * 0.5, major * 0.8);
    float frost = smoothstep(0.42, 0.72, noise(p * 0.45 + 3.0));
    float grain = 0.55 + 0.45 * noise(p * 4.0);
    line *= frost * grain;

    // Confined to the island and fading toward its edge
    float edge = max(abs(p.x), abs(p.y));
    float mask = 1.0 - smoothstep(17.0, 23.0, edge);

    vec3 colour = vec3(0.62, 0.88, 1.0);
    gl_FragColor = vec4(colour, line * mask * uAlpha);
  }
`

/**
 * A measuring grid in the ground, present for a little while around 05:36 and
 * otherwise not there at all. Reads as frost or dew lines; is not.
 */
export function DawnGrid() {
  const meshRef = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: gridVertex,
        fragmentShader: gridFragment,
        uniforms: { uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const hour = useSceneStore.getState().timeOfDay
    // The Hollow is the unmaintained world, so the grid belongs to the garden
    const a = dawnFactor(hour) * 0.11 * traces.gridBoost * (1 - hollow.amount)
    material.uniforms.uAlpha.value = Math.min(1, a)
    mesh.visible = a > 0.004
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.045, 0]}
      visible={false}
      raycast={() => null}
      renderOrder={3}
    >
      <planeGeometry args={[48, 48]} />
    </mesh>
  )
}
