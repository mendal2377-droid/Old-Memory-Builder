import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { CatmullRomCurve3, Vector3, type Group } from 'three'
import { useSceneStore } from '../../store/sceneStore'

const butterflyPath = new CatmullRomCurve3(
  [
    new Vector3(-8, 1.05, 5),
    new Vector3(-3, 1.25, 7),
    new Vector3(2, 1.1, 4),
    new Vector3(6, 1.35, 0),
    new Vector3(1, 1.15, -3),
    new Vector3(-5, 1.3, -1),
  ],
  true,
)

const birdPath = new CatmullRomCurve3(
  [
    new Vector3(-12, 3.6, -9),
    new Vector3(-4, 4.2, -12),
    new Vector3(7, 3.8, -8),
    new Vector3(12, 3.4, 0),
    new Vector3(4, 4.1, 8),
    new Vector3(-9, 3.7, 7),
  ],
  true,
)

function CompanionButterfly() {
  const groupRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    const group = groupRef.current

    if (!group) {
      return
    }

    const t = (clock.elapsedTime * 0.035) % 1
    const position = butterflyPath.getPointAt(t)
    const tangent = butterflyPath.getTangentAt(t)

    group.position.copy(position)
    group.position.y += Math.sin(clock.elapsedTime * 3.1) * 0.12
    group.rotation.y = Math.atan2(tangent.x, tangent.z)
    group.rotation.z = Math.sin(clock.elapsedTime * 8) * 0.18
  })

  return (
    <group ref={groupRef}>
      <mesh position={[-0.055, 0, 0]} rotation={[0, 0, 0.45]}>
        <circleGeometry args={[0.09, 10]} />
        <meshBasicMaterial color="#f2b36d" transparent opacity={0.86} />
      </mesh>
      <mesh position={[0.055, 0, 0]} rotation={[0, 0, -0.45]}>
        <circleGeometry args={[0.09, 10]} />
        <meshBasicMaterial color="#e87fa0" transparent opacity={0.82} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#4f3b32" />
      </mesh>
    </group>
  )
}

function CompanionBird() {
  const groupRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    const group = groupRef.current

    if (!group) {
      return
    }

    const t = (clock.elapsedTime * 0.018 + 0.32) % 1
    const position = birdPath.getPointAt(t)
    const tangent = birdPath.getTangentAt(t)

    group.position.copy(position)
    group.position.y += Math.sin(clock.elapsedTime * 1.8) * 0.18
    group.rotation.y = Math.atan2(tangent.x, tangent.z)
    group.rotation.x = Math.sin(clock.elapsedTime * 5.6) * 0.08
  })

  return (
    <group ref={groupRef}>
      <mesh scale={[0.16, 0.08, 0.09]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial color="#4f5f78" />
      </mesh>
      <mesh position={[-0.14, 0, 0]} rotation={[0, 0, 0.35]}>
        <coneGeometry args={[0.05, 0.22, 3]} />
        <meshBasicMaterial color="#7c8da5" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0.14, 0, 0]} rotation={[0, 0, -0.35]}>
        <coneGeometry args={[0.05, 0.22, 3]} />
        <meshBasicMaterial color="#7c8da5" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

export function MemoryCompanions() {
  const cameraMode = useSceneStore((state) => state.cameraMode)

  return (
    <group visible={cameraMode === 'build' || cameraMode === 'walk'}>
      <CompanionButterfly />
      <CompanionBird />
    </group>
  )
}
