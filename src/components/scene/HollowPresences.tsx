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
      Array.from({ length: 4 }).map((_, i) => ({
        y: 0.45 + i * 0.5,
        scale: 34 + i * 5,
        drift: 0.006 + i * 0.0022,
        phase: (i / 4) * Math.PI * 2,
        opacity: 0.038 - i * 0.006,
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
