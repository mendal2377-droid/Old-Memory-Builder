import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group, type Mesh } from 'three'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'

/**
 * Things moving in the sky over the Hollow.
 *
 * They wheel on long slow orbits far overhead and never descend, never turn
 * toward you, never react to anything you do. That indifference is the point:
 * something hunting you turns a garden into a game, and the moment this place
 * becomes a threat you stop wanting to come back. Something enormous that has
 * always been circling and has simply never noticed you is a colder feeling
 * and it leaves the ground safe to walk.
 *
 * Read as silhouettes only — no lit surfaces, no detail, no eyes.
 */

const BODY = '#0d0f11'
const MEMBRANE = '#15181b'

interface Drifter {
  radius: number
  height: number
  speed: number
  phase: number
  scale: number
  tilt: number
  beatRate: number
}

export function HollowPresences() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const groupRefs = useRef<Array<Group | null>>([])
  const wingRefs = useRef<Array<Group | null>>([])
  const rootRef = useRef<Group>(null)

  const drifters = useMemo<Drifter[]>(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        // Wide orbits, well outside the island, so they read as distant
        radius: 34 + i * 9 + Math.random() * 8,
        height: 19 + Math.random() * 20,
        // Slow. A fast silhouette reads as a bird; a slow one reads as big.
        speed: 0.028 + Math.random() * 0.022,
        phase: Math.random() * Math.PI * 2,
        scale: 2.6 + Math.random() * 2.8,
        tilt: (Math.random() - 0.5) * 0.3,
        beatRate: 0.22 + Math.random() * 0.16,
      })),
    [],
  )

  useFrame(({ clock }) => {
    const h = hollow.amount
    if (rootRef.current) rootRef.current.visible = h > 0.05
    if (h <= 0.05) return

    const t = clock.elapsedTime
    drifters.forEach((d, i) => {
      const g = groupRefs.current[i]
      if (!g) return
      const a = d.phase + t * d.speed
      g.position.set(
        Math.cos(a) * d.radius,
        d.height + Math.sin(t * 0.09 + d.phase) * 2.2,
        Math.sin(a) * d.radius,
      )
      // Face along the orbit, banked into the turn
      g.rotation.set(d.tilt, -a + Math.PI / 2, 0.16)
      g.scale.setScalar(d.scale * Math.min(1, (h - 0.05) / 0.5))

      const w = wingRefs.current[i]
      if (w) {
        // A long, tired beat rather than flapping
        const beat = Math.sin(t * d.beatRate + d.phase)
        w.rotation.z = beat * 0.22
        w.rotation.x = beat * 0.06
      }
    })
  })

  if (cameraMode !== 'walk') return null

  return (
    <group ref={rootRef}>
      {drifters.map((_, i) => (
        <group
          key={`drifter-${i}`}
          ref={(el) => {
            groupRefs.current[i] = el
          }}
          raycast={() => null}
        >
          {/* Body: a long tapered spine */}
          <mesh rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
            <coneGeometry args={[0.26, 2.4, 6]} />
            <meshStandardMaterial color={BODY} roughness={1} flatShading />
          </mesh>
          <mesh position={[-1.05, 0, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={() => null}>
            <coneGeometry args={[0.2, 1.3, 6]} />
            <meshStandardMaterial color={BODY} roughness={1} flatShading />
          </mesh>
          {/* Membrane wings, beating slowly */}
          <group
            ref={(el) => {
              wingRefs.current[i] = el
            }}
          >
            {[1, -1].map((s) => (
              <mesh
                key={`wing-${s}`}
                position={[0.1, 0, s * 1.35]}
                rotation={[0, 0, s * 0.08]}
                raycast={() => null}
              >
                <planeGeometry args={[1.9, 2.7]} />
                <meshStandardMaterial
                  color={MEMBRANE}
                  roughness={1}
                  side={DoubleSide}
                  transparent
                  opacity={0.93}
                  flatShading
                />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}

/**
 * Low mist lying over the Hollow.
 *
 * The garden has clear air. Giving this place something in the air that the
 * other one does not have is half of what stops it reading as a filter.
 */
export function HollowMist() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const refs = useRef<Array<Mesh | null>>([])
  const rootRef = useRef<Group>(null)

  const sheets = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        y: 0.5 + i * 0.42,
        scale: 34 + i * 5,
        drift: 0.006 + i * 0.0022,
        phase: (i / 7) * Math.PI * 2,
        opacity: 0.085 - i * 0.008,
      })),
    [],
  )

  useFrame(({ clock }) => {
    const h = hollow.amount
    if (rootRef.current) rootRef.current.visible = h > 0.05
    if (h <= 0.05) return
    const t = clock.elapsedTime
    sheets.forEach((sh, i) => {
      const m = refs.current[i]
      if (!m) return
      m.rotation.z = sh.phase + t * sh.drift
      const mat = m.material as { opacity: number }
      mat.opacity = sh.opacity * h
    })
  })

  if (cameraMode !== 'walk') return null

  return (
    <group ref={rootRef}>
      {sheets.map((sh, i) => (
        <mesh
          key={`mist-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={[0, sh.y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <circleGeometry args={[sh.scale, 26]} />
          <meshBasicMaterial
            color="#b9bcc0"
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
