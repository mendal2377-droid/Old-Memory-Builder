import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, type Mesh } from 'three'

/**
 * Low technology worn into the ground.
 *
 * The mid-distance towers were the last unfinished thing on the island: close
 * enough to show their plain geometry, too big to ignore, and with no reason
 * to be where they were. Large structures read better as distant silhouettes,
 * so they now live only on the far skyline, and what stands near the walk is
 * this instead — ribs half buried in the soil, cable running through split
 * rock, and low markers. Small, old, and clearly built, but grown over.
 */

const METAL = '#4a5262'
const METAL_LIT = '#5d6678'
const ROCK = '#7b7d82'
const MOSS = '#557f4a'
const GLOW = '#6fd8ff'

/** Deterministic scatter so nothing reshuffles between frames. */
function hash(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return n - Math.floor(n)
}

interface Site {
  x: number
  z: number
  yaw: number
  kind: 'rib' | 'cable' | 'pillar'
  scale: number
  phase: number
}

/**
 * Placed around the outer walk, clear of the river and of the terrace, since
 * both already have their own built language.
 */
function useSites(): Site[] {
  return useMemo(() => {
    const river: Array<[number, number, number, number]> = [
      [13, -22, 4.2, 5.2],
      [12, -15, 4.4, 5.4],
      [13, -8, 4.2, 5.2],
      [16, -1, 4.6, 5.8],
      [18, 6, 4.3, 5.4],
      [17, 13, 4.4, 5.6],
      [15, 20, 4, 5],
    ]
    const overWater = (x: number, z: number) =>
      river.some(([cx, cz, w, l]) => {
        const dx = (x - cx) / w
        const dz = (z - cz) / l
        return dx * dx + dz * dz < 1.4
      })

    const out: Site[] = []
    const wanted = 14
    for (let i = 0; i < wanted * 8 && out.length < wanted; i += 1) {
      const a = hash(i, 1) * Math.PI * 2
      const r = 13.5 + hash(i, 2) * 4.5
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (overWater(x, z)) continue
      // Leave the terrace its own ground
      if (Math.hypot(x - 2.4, z + 13.6) < 8) continue
      // Nothing right on top of another
      if (out.some((s) => Math.hypot(s.x - x, s.z - z) < 3.4)) continue

      const roll = hash(i, 3)
      out.push({
        x,
        z,
        yaw: hash(i, 4) * Math.PI * 2,
        kind: roll < 0.4 ? 'rib' : roll < 0.75 ? 'cable' : 'pillar',
        scale: 0.8 + hash(i, 5) * 0.5,
        phase: hash(i, 6) * Math.PI * 2,
      })
    }
    return out
  }, [])
}

/** A structural rib surfacing out of the soil, most of it still buried. */
function Rib({ site }: { site: Site }) {
  const s = site.scale
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.yaw, 0]}>
      {[0, 1, 2].map((i) => {
        const lean = (i - 1) * 0.16
        return (
          <mesh
            key={`rib-${i}`}
            position={[(i - 1) * 0.85 * s, 0.34 * s, 0]}
            rotation={[0, 0, lean]}
            castShadow
            raycast={() => null}
          >
            <boxGeometry args={[0.22 * s, 1.1 * s, 0.5 * s]} />
            <meshStandardMaterial
              color={METAL}
              roughness={0.85}
              metalness={0.3}
              flatShading
            />
          </mesh>
        )
      })}
      {/* Soil and moss banked against the base */}
      <mesh position={[0, 0.12 * s, 0]} receiveShadow raycast={() => null}>
        <boxGeometry args={[3.1 * s, 0.3 * s, 1.15 * s]} />
        <meshStandardMaterial color={MOSS} roughness={1} flatShading />
      </mesh>
    </group>
  )
}

/** Split rock with a cable of light running through the break. */
function CableRock({ site, glowRef }: { site: Site; glowRef: (m: Mesh | null) => void }) {
  const s = site.scale
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.yaw, 0]}>
      {[-1, 1].map((sx) => (
        <mesh
          key={`half-${sx}`}
          position={[sx * 0.52 * s, 0.38 * s, 0]}
          rotation={[0.1 * sx, 0.3 * sx, 0.12 * sx]}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <dodecahedronGeometry args={[0.62 * s, 0]} />
          <meshStandardMaterial color={ROCK} roughness={1} flatShading />
        </mesh>
      ))}
      {/* The cable itself, bridging the split */}
      <mesh
        position={[0, 0.42 * s, 0]}
        rotation={[0, 0, Math.PI / 2]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.07 * s, 0.07 * s, 1.25 * s, 6]} />
        <meshStandardMaterial color={METAL_LIT} roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.42 * s, 0.09 * s]} raycast={() => null}>
        <planeGeometry args={[1.0 * s, 0.07 * s]} />
        <meshBasicMaterial
          color={GLOW}
          transparent
          opacity={0.4}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

/** A low energy post, knee height, with grass grown up around its foot. */
function Pillar({ site, glowRef }: { site: Site; glowRef: (m: Mesh | null) => void }) {
  const s = site.scale
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.yaw, 0]}>
      <mesh position={[0, 0.42 * s, 0]} castShadow raycast={() => null}>
        <boxGeometry args={[0.34 * s, 0.85 * s, 0.34 * s]} />
        <meshStandardMaterial
          color={METAL}
          roughness={0.8}
          metalness={0.3}
          flatShading
        />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.62 * s, 0.18 * s]} raycast={() => null}>
        <planeGeometry args={[0.2 * s, 0.34 * s]} />
        <meshBasicMaterial
          color={GLOW}
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Growth reclaiming the foot */}
      <mesh position={[0, 0.11 * s, 0]} receiveShadow raycast={() => null}>
        <coneGeometry args={[0.42 * s, 0.28 * s, 6]} />
        <meshStandardMaterial color={MOSS} roughness={1} flatShading />
      </mesh>
    </group>
  )
}

export function EmbeddedTech() {
  const sites = useSites()
  const glows = useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    glows.current.forEach((m, i) => {
      if (!m) return
      const mat = m.material as { opacity: number }
      // Very slow and shallow: this is old equipment idling, not signalling
      mat.opacity = 0.24 + Math.abs(Math.sin(t * 0.3 + (sites[i]?.phase ?? 0))) * 0.2
    })
  })

  return (
    <group>
      {sites.map((site, i) => {
        const setGlow = (m: Mesh | null) => {
          glows.current[i] = m
        }
        if (site.kind === 'rib') return <Rib key={`tech-${i}`} site={site} />
        if (site.kind === 'cable')
          return <CableRock key={`tech-${i}`} site={site} glowRef={setGlow} />
        return <Pillar key={`tech-${i}`} site={site} glowRef={setGlow} />
      })}
    </group>
  )
}
