import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  DoubleSide,
  type Mesh,
} from 'three'

/**
 * The observation sanctuary: a built terrace where the island used to just
 * stop.
 *
 * The bare outer ring never had a reason to exist, so it read as unfinished
 * terrain rather than a destination. This gives that edge a purpose — somewhere
 * to arrive, sit, and look out — and it is where the natural and the built
 * parts of the island are meant to meet most plainly: cut stone with light
 * run through it, growing straight out of the rock.
 */

const STONE = '#71767f'
const STONE_DARK = '#4b5058'
const STONE_EDGE = '#878d96'
const CYBER_ROCK = '#3f4550'
const GLOW = '#6fd8ff'

/**
 * Centre of the terrace. Chosen by searching the rim for the point with the
 * greatest clearance to every placed object that is also dry and fully inside
 * the walkable square -- the first spot I picked by eye had a pine standing
 * 4 units away, which is inside the paving.
 */
const SITE_X = 2.4
const SITE_Z = -13.6
/** Facing out from the middle of the island, toward open space. */
const OUT_YAW = Math.atan2(SITE_X, SITE_Z)

const RADIUS = 5

/** Light run into the paving, breathing very slowly so the stone feels alive. */
function InlaidLight() {
  const refs = useRef<Array<Mesh | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const mat = m.material as { opacity: number }
      mat.opacity = 0.3 + Math.abs(Math.sin(t * 0.42 + i * 1.1)) * 0.28
    })
  })

  const arcs = useMemo(
    () => [
      { inner: 2.15, outer: 2.28, start: -0.5, sweep: Math.PI * 1.15 },
      { inner: 3.5, outer: 3.62, start: Math.PI * 0.55, sweep: Math.PI * 1.05 },
      { inner: 4.42, outer: 4.54, start: -1.15, sweep: Math.PI * 0.8 },
    ],
    [],
  )

  return (
    <group>
      {arcs.map((a, i) => (
        <mesh
          key={`arc-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, a.start]}
          position={[0, 0.28, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[a.inner, a.outer, 46, 1, 0, a.sweep]} />
          <meshBasicMaterial
            color={GLOW}
            transparent
            opacity={0.45}
            side={DoubleSide}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Low railing around the seaward edge, so the drop feels held rather than open. */
function Railing() {
  const posts = useMemo(() => {
    // Only the outward-facing arc is railed; the garden side stays open so the
    // terrace has an obvious way in.
    const start = -Math.PI * 0.62
    const sweep = Math.PI * 1.24
    const count = 15
    return Array.from({ length: count }).map((_, i) => {
      const a = start + (i / (count - 1)) * sweep
      return { x: Math.cos(a) * (RADIUS - 0.32), z: Math.sin(a) * (RADIUS - 0.32), a }
    })
  }, [])

  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={`post-${i}`} position={[p.x, 0.72, p.z]} castShadow raycast={() => null}>
          <boxGeometry args={[0.11, 0.85, 0.11]} />
          <meshStandardMaterial color={STONE_DARK} roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
      {/* Top rail, following the same arc */}
      <mesh
        position={[0, 1.16, 0]}
        rotation={[Math.PI / 2, 0, -Math.PI * 0.62]}
        castShadow
        raycast={() => null}
      >
        <torusGeometry args={[RADIUS - 0.32, 0.062, 6, 60, Math.PI * 1.24]} />
        <meshStandardMaterial color={STONE_EDGE} roughness={0.8} metalness={0.2} />
      </mesh>
    </group>
  )
}

/** A plain wooden bench, turned to face the open horizon. */
function Bench() {
  return (
    <group position={[0, 0, 0.55]} rotation={[0, OUT_YAW, 0]}>
      {/* Seat */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[1.95, 0.09, 0.56]} />
        <meshStandardMaterial color="#8a6242" roughness={0.9} />
      </mesh>
      {/* Back */}
      <mesh
        position={[0, 0.9, -0.24]}
        rotation={[-0.18, 0, 0]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[1.95, 0.5, 0.08]} />
        <meshStandardMaterial color="#8a6242" roughness={0.9} />
      </mesh>
      {/* Legs */}
      {[-0.82, 0.82].map((sx) => (
        <mesh key={`leg-${sx}`} position={[sx, 0.26, 0]} castShadow raycast={() => null}>
          <boxGeometry args={[0.1, 0.52, 0.5]} />
          <meshStandardMaterial color="#5f4630" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Cut stone with light in it, growing out of a rock shoulder — the clearest
 * statement of the island's premise, that nature has grown through technology.
 */
function CyberStonework() {
  const glowRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!glowRef.current) return
    const mat = glowRef.current.material as { opacity: number }
    mat.opacity = 0.5 + Math.sin(clock.elapsedTime * 0.55) * 0.14
  })

  return (
    <group position={[RADIUS * 0.86, 0, -RADIUS * 0.5]} rotation={[0, -0.5, 0]}>
      {/* Rock shoulder */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[2.1, 1.7, 1.9]} />
        <meshStandardMaterial color={CYBER_ROCK} roughness={1} flatShading />
      </mesh>
      {/* The cut column standing in it */}
      <mesh position={[0, 2.15, 0.12]} castShadow raycast={() => null}>
        <boxGeometry args={[1.25, 2.9, 1.15]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.85} metalness={0.2} />
      </mesh>
      {/* Lit panels set into the face */}
      {[-0.3, 0.3].map((sx) => (
        <mesh
          key={`panel-${sx}`}
          ref={sx > 0 ? glowRef : undefined}
          position={[sx, 2.2, 0.71]}
          raycast={() => null}
        >
          <planeGeometry args={[0.3, 1.85]} />
          <meshBasicMaterial
            color={GLOW}
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
      {/* Light spilling onto the stone around it */}
      <pointLight
        position={[0, 2.3, 1.1]}
        color={GLOW}
        intensity={1.5}
        distance={7}
        decay={2}
      />
      {/* Growth taking the top back */}
      <mesh position={[0.1, 3.68, 0.1]} raycast={() => null}>
        <sphereGeometry args={[0.62, 10, 8]} />
        <meshStandardMaterial color="#4f7a45" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

/** Low markers picking out the way in, as on the approach path in the reference. */
function PathMarkers() {
  return (
    <group>
      {[
        [-1.4, RADIUS + 1.5],
        [1.5, RADIUS + 2.6],
        [-1.2, RADIUS + 4.1],
        [1.7, RADIUS + 5.4],
      ].map(([sx, sz], i) => (
        <group key={`marker-${i}`} position={[sx, 0, sz]}>
          <mesh position={[0, 0.24, 0]} castShadow raycast={() => null}>
            <boxGeometry args={[0.16, 0.48, 0.16]} />
            <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.5, 0]} raycast={() => null}>
            <boxGeometry args={[0.19, 0.06, 0.19]} />
            <meshBasicMaterial
              color={GLOW}
              transparent
              opacity={0.7}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function ObservationTerrace() {
  return (
    <group position={[SITE_X, 0, SITE_Z]} rotation={[0, OUT_YAW, 0]}>
      {/* Paving slab, sunk just proud of the grass */}
      <mesh position={[0, 0.13, 0]} receiveShadow raycast={() => null}>
        <cylinderGeometry args={[RADIUS, RADIUS - 0.18, 0.26, 40]} />
        <meshStandardMaterial color={STONE} roughness={0.94} metalness={0.05} />
      </mesh>
      {/* A darker inner ring, so the paving is not one flat disc */}
      <mesh position={[0, 0.265, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <ringGeometry args={[0, 2.9, 40]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.96} side={DoubleSide} />
      </mesh>
      <InlaidLight />
      <Railing />
      <Bench />
      <CyberStonework />
      <PathMarkers />
    </group>
  )
}

export { SITE_X, SITE_Z, RADIUS as TERRACE_RADIUS }
