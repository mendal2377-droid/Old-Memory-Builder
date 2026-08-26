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
      mat.opacity = 0.16 + Math.abs(Math.sin(t * 0.35 + i * 1.1)) * 0.14
    })
  })

  const arcs = useMemo(
    () => [
      // One quiet arc, reading as a worn inlay rather than a landing pad
      { inner: 3.62, outer: 3.7, start: Math.PI * 0.62, sweep: Math.PI * 0.86 },
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
          position={[0, 0.13, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[a.inner, a.outer, 46, 1, 0, a.sweep]} />
          <meshBasicMaterial
            color={GLOW}
            transparent
            opacity={0.22}
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
    const start = -Math.PI * 0.34
    const sweep = Math.PI * 0.68
    const count = 9
    return Array.from({ length: count }).map((_, i) => {
      const a = start + (i / (count - 1)) * sweep
      return { x: Math.cos(a) * (RADIUS - 0.32), z: Math.sin(a) * (RADIUS - 0.32), a }
    })
  }, [])

  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={`post-${i}`} position={[p.x, 0.42, p.z]} castShadow raycast={() => null}>
          <boxGeometry args={[0.1, 0.66, 0.1]} />
          <meshStandardMaterial color={STONE_DARK} roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
      {/* Top rail, following the same arc */}
      <mesh
        position={[0, 0.79, 0]}
        rotation={[Math.PI / 2, 0, -Math.PI * 0.34]}
        castShadow
        raycast={() => null}
      >
        <torusGeometry args={[RADIUS - 0.32, 0.055, 6, 40, Math.PI * 0.68]} />
        <meshStandardMaterial color={STONE_EDGE} roughness={0.8} metalness={0.2} />
      </mesh>
    </group>
  )
}

/** A plain wooden bench, turned to face the open horizon. */
function Bench() {
  return (
    <group position={[0, 0, -1.15]}>
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
 * Weathered stone worn back into the ground, with a seam of light still alive
 * in it and moss taking the top. The upright column here read as a machine
 * dropped on the lawn; low broken stone reads as something old that was
 * repaired, which is what this place is meant to be.
 */
function SunkenStones() {
  const glowRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!glowRef.current) return
    const mat = glowRef.current.material as { opacity: number }
    mat.opacity = 0.26 + Math.sin(clock.elapsedTime * 0.4) * 0.1
  })

  const blocks = useMemo(
    () => [
      { a: 2.05, r: RADIUS + 0.55, w: 1.5, h: 0.62, d: 1.1, tilt: 0.12 },
      { a: 2.62, r: RADIUS + 0.35, w: 1.1, h: 0.4, d: 0.95, tilt: -0.09 },
      { a: 3.5, r: RADIUS + 0.7, w: 1.35, h: 0.5, d: 1.0, tilt: 0.07 },
    ],
    [],
  )

  return (
    <group>
      {blocks.map((bl, i) => (
        <group
          key={`stone-${i}`}
          position={[Math.cos(bl.a) * bl.r, 0, Math.sin(bl.a) * bl.r]}
          rotation={[bl.tilt, bl.a, 0]}
        >
          <mesh position={[0, bl.h * 0.42, 0]} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[bl.w, bl.h, bl.d]} />
            <meshStandardMaterial color={CYBER_ROCK} roughness={1} flatShading />
          </mesh>
          {/* Moss along the top edge */}
          <mesh position={[0, bl.h * 0.86, 0]} raycast={() => null}>
            <boxGeometry args={[bl.w * 0.82, bl.h * 0.14, bl.d * 0.8]} />
            <meshStandardMaterial color="#4f7a45" roughness={1} flatShading />
          </mesh>
          {/* A seam of light still running through the break */}
          {i === 0 ? (
            <mesh ref={glowRef} position={[0, bl.h * 0.45, bl.d * 0.52]} raycast={() => null}>
              <planeGeometry args={[bl.w * 0.66, 0.055]} />
              <meshBasicMaterial
                color={GLOW}
                transparent
                opacity={0.3}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  )
}

/** Rocks, tufts and small flowers softening where paving meets grass. */
function EdgeDressing() {
  const bits = useMemo(() => {
    const out: Array<{
      x: number
      z: number
      s: number
      kind: 'rock' | 'tuft' | 'flower'
      rot: number
    }> = []
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.21
      const r = RADIUS + 0.1 + ((i * 7919) % 100) / 100 * 1.5
      const kind = i % 4 === 0 ? 'rock' : i % 4 === 1 ? 'flower' : 'tuft'
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: 0.6 + ((i * 6131) % 100) / 100 * 0.7,
        kind,
        rot: (i * 1.37) % (Math.PI * 2),
      })
    }
    return out
  }, [])

  return (
    <group>
      {bits.map((bt, i) => (
        <group key={`edge-${i}`} position={[bt.x, 0, bt.z]} rotation={[0, bt.rot, 0]}>
          {bt.kind === 'rock' ? (
            <mesh position={[0, 0.1 * bt.s, 0]} castShadow raycast={() => null}>
              <dodecahedronGeometry args={[0.22 * bt.s, 0]} />
              <meshStandardMaterial color="#7b7d82" roughness={1} flatShading />
            </mesh>
          ) : bt.kind === 'flower' ? (
            <mesh position={[0, 0.16 * bt.s, 0]} raycast={() => null}>
              <sphereGeometry args={[0.09 * bt.s, 6, 5]} />
              <meshStandardMaterial color="#e8dcc8" roughness={1} flatShading />
            </mesh>
          ) : (
            <mesh position={[0, 0.17 * bt.s, 0]} raycast={() => null}>
              <coneGeometry args={[0.13 * bt.s, 0.34 * bt.s, 5]} />
              <meshStandardMaterial color="#6d9a55" roughness={1} flatShading />
            </mesh>
          )}
        </group>
      ))}
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
      <mesh position={[0, 0.055, 0]} receiveShadow raycast={() => null}>
        <cylinderGeometry args={[RADIUS, RADIUS - 0.3, 0.13, 40]} />
        <meshStandardMaterial color={STONE} roughness={0.94} metalness={0.05} />
      </mesh>
      {/* A darker inner ring, so the paving is not one flat disc */}
      <mesh position={[0, 0.122, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <ringGeometry args={[0, 2.9, 40]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.96} side={DoubleSide} />
      </mesh>
      <InlaidLight />
      <Railing />
      <Bench />
      <SunkenStones />
      <EdgeDressing />
      <PathMarkers />
    </group>
  )
}

export { SITE_X, SITE_Z, RADIUS as TERRACE_RADIUS }
