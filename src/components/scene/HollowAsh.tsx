import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Object3D, type InstancedMesh } from 'three'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'

/**
 * Ash over the Hollow.
 *
 * The garden has leaves falling under one tree; over there it falls on
 * everything, and it is grey. Deliberately slow and sparse — this is meant to
 * read as a place that has been still for a long time, not as weather.
 */

const COUNT = 260
/** Drifts over the walkable area and a little beyond. */
const SPREAD = 26
const CEILING = 11

export function HollowAsh() {
  const meshRef = useRef<InstancedMesh>(null)
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const dummy = useMemo(() => new Object3D(), [])

  const seeds = useMemo(() => {
    const a = new Float32Array(COUNT * 5)
    for (let i = 0; i < COUNT; i += 1) {
      a[i * 5] = (Math.random() - 0.5) * SPREAD * 2
      a[i * 5 + 1] = Math.random()
      a[i * 5 + 2] = (Math.random() - 0.5) * SPREAD * 2
      a[i * 5 + 3] = 0.35 + Math.random() * 0.8
      a[i * 5 + 4] = Math.random() * Math.PI * 2
    }
    return a
  }, [])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return

    const h = hollow.amount
    mesh.visible = h > 0.02
    if (!mesh.visible) return

    const t = clock.elapsedTime
    for (let i = 0; i < COUNT; i += 1) {
      const ox = seeds[i * 5]
      const phase = seeds[i * 5 + 1]
      const oz = seeds[i * 5 + 2]
      const speed = seeds[i * 5 + 3]
      const spin = seeds[i * 5 + 4]

      const fall = (phase + t * 0.016 * speed) % 1
      const y = CEILING * (1 - fall)
      // Ash does not fall straight; it wanders
      const driftX = Math.sin(t * 0.22 * speed + spin) * 1.5
      const driftZ = Math.cos(t * 0.17 * speed + spin * 1.7) * 1.2

      dummy.position.set(ox + driftX, y, oz + driftZ)
      dummy.rotation.set(t * 0.3 * speed + spin, spin + t * 0.2, 0)
      // Fade in near the top and out at the ground, and with the crossing
      const life = Math.min(1, fall * 8) * Math.min(1, (1 - fall) * 5 + 0.1)
      dummy.scale.setScalar(0.035 * life * h)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (cameraMode !== 'walk') return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      raycast={() => null}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#9a9a98"
        transparent
        opacity={0.55}
        side={DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
