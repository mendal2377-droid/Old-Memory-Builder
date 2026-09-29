import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, type Mesh } from 'three'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'

/**
 * A serpent swimming over the Hollow.
 *
 * The abstract drifters this replaces read as pale slabs rather than as
 * anything alive. A body you can name — a head, a spine that follows it,
 * a tail that whips last — is recognisable at any distance and at any size,
 * which is the whole job.
 *
 * It renders unlit on purpose. A lit dark material still picks up ambient and
 * comes out mid-grey against a pale sky; an unlit one is exactly the value you
 * ask for, so the silhouette holds no matter how bright the Hollow gets.
 *
 * It circles and never approaches. Nothing here should hunt you.
 */

const SEGMENTS = 46
/**
 * How far behind the head each segment trails. Chosen with SEGMENTS so the
 * body still spans ~2.5s (which is what gives it its curve) while the spacing
 * stays tight enough that the thin tail reads as a continuous body rather than
 * a dotted line.
 */
const LAG = 0.055

const HIDE = '#101316'
const HIDE_DARK = '#0a0c0e'

/** The path the head swims, sampled at a time offset for each segment. */
function samplePath(t: number, out: { x: number; y: number; z: number }) {
  const a = t * 0.16
  // The orbit itself wanders in and out rather than being a clean circle
  const radius = 42 + Math.sin(t * 0.09) * 11
  out.x = Math.cos(a) * radius
  out.z = Math.sin(a) * radius
  // Rises and dives, and never comes near the ground
  out.y = 23.5 + Math.sin(t * 0.21) * 7.5 + Math.sin(t * 0.47 + 1.3) * 2.2

  // Undulation. The orbit alone only turns 0.41 rad across the 2.55s the body
  // spans, so without this the whole animal is a rigid pole being flown in a
  // circle. This wave completes most of an S within the body's own length,
  // which is what makes it swim.
  // Frequency is set so the wave completes a full period across the 2.55s the
  // body spans (2*pi / 2.55 ~= 2.46). At the 1.15 I first tried, the phase only
  // advanced 2.9 rad head-to-tail -- a shallow C, measured at 0.98 straightness,
  // which still flew like a pole.
  const wiggle = Math.sin(t * 2.46) * 3.6
  out.x += -Math.sin(a) * wiggle
  out.z += Math.cos(a) * wiggle
  out.y += Math.sin(t * 1.9 + 0.7) * 1.9
  return out
}

export function HollowSerpent() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const rootRef = useRef<Group>(null)
  const segRefs = useRef<Array<Mesh | null>>([])
  const headRef = useRef<Group>(null)

  const scratch = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  const ahead = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])

  // Thickest a third of the way down, tapering to a point at the tail
  const sizes = useMemo(
    () =>
      Array.from({ length: SEGMENTS }).map((_, i) => {
        // Thickens fast behind the head, then tapers the whole way to a
        // point. The first version left the tail thicker than the neck.
        const u = i / (SEGMENTS - 1)
        const belly = Math.sin(Math.min(1, u * 3.2) * Math.PI * 0.5)
        const taper = Math.pow(1 - u, 0.8)
        // The floor is deliberately not zero. Tapering to a true point left
        // tail segments 0.6 across being flung 1.0 apart at the peak of a
        // wave, so the tail came apart into a dotted line.
        return 0.52 + belly * taper * 0.72
      }),
    [],
  )

  useFrame(({ clock }) => {
    const h = hollow.amount
    if (rootRef.current) rootRef.current.visible = h > 0.06
    if (h <= 0.06) return

    const t = clock.elapsedTime
    const fade = Math.min(1, (h - 0.06) / 0.5)

    for (let i = 0; i < SEGMENTS; i += 1) {
      const m = segRefs.current[i]
      if (!m) continue
      samplePath(t - i * LAG, scratch)
      m.position.set(scratch.x, scratch.y, scratch.z)
      m.scale.setScalar(sizes[i] * fade)
    }

    // Point the head where it is going, so it leads rather than slides
    if (headRef.current) {
      samplePath(t, scratch)
      samplePath(t + 0.2, ahead)
      headRef.current.position.set(scratch.x, scratch.y, scratch.z)
      headRef.current.lookAt(ahead.x, ahead.y, ahead.z)
      headRef.current.scale.setScalar(1.45 * fade)
    }
  })

  if (cameraMode !== 'walk') return null

  return (
    <group ref={rootRef} raycast={() => null}>
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <mesh
          key={`seg-${i}`}
          ref={(el) => {
            segRefs.current[i] = el
          }}
          raycast={() => null}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={i % 2 === 0 ? HIDE : HIDE_DARK} toneMapped={false} />
        </mesh>
      ))}

      {/* Head: a wedge with a heavier brow, so it reads as facing somewhere */}
      <group ref={headRef} raycast={() => null}>
        <mesh raycast={() => null}>
          <coneGeometry args={[0.85, 2.3, 5]} />
          <meshBasicMaterial color={HIDE} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.34, -0.2]} raycast={() => null}>
          <boxGeometry args={[1.1, 0.42, 1.0]} />
          <meshBasicMaterial color={HIDE_DARK} toneMapped={false} />
        </mesh>
        {/* A suggestion of a jaw, open a little */}
        <mesh position={[0, -0.36, 0.5]} rotation={[0.22, 0, 0]} raycast={() => null}>
          <boxGeometry args={[0.82, 0.22, 1.5]} />
          <meshBasicMaterial color={HIDE_DARK} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
