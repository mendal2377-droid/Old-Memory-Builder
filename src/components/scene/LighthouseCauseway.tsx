import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type InstancedMesh } from 'three'
import { CAUSEWAY_HALF_WIDTH, getCauseway } from '../../data/causeway'
import { hollow } from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'

/**
 * The road to the lighthouse: a raised stone causeway leaving the end of the
 * bridge, edged with a row of lamps down each side. A pulse of light runs
 * along them toward the lighthouse, over and over, and the last few lamps flash
 * together as it arrives -- so even from across the water you can see which way
 * to go.
 */

const DECK_TOP = 0.48 // flush with the bridge deck
const DECK_THICKNESS = 0.55
const LAMP_SPACING = 0.55
const LAMP_OFFSET = CAUSEWAY_HALF_WIDTH - 0.12
const SPEED = 3.4
const WARM = new Color(1.0, 0.78, 0.4)

interface Lamp {
  x: number
  z: number
  along: number
  yaw: number
}

export function LighthouseCauseway() {
  const sceneObjects = useSceneStore((s) => s.sceneObjects)
  const lampsRef = useRef<InstancedMesh>(null)
  const colour = useMemo(() => new Color(), [])
  const dummy = useMemo(() => new Object3D(), [])

  const causeway = useMemo(() => getCauseway(sceneObjects), [sceneObjects])

  const { segments, lamps } = useMemo(() => {
    if (!causeway) return { segments: [], lamps: [] as Lamp[] }
    const pts = causeway.points
    const segs = []
    const lamps: Lamp[] = []
    let travelled = 0
    let nextLamp = LAMP_SPACING / 2
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]
      const b = pts[i + 1]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      const yaw = -Math.atan2(dz, dx)
      segs.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len, yaw })
      // Lamps at fixed spacing along the whole road, a pair at each station
      const nx = -dz / len
      const nz = dx / len
      while (nextLamp <= travelled + len) {
        const f = (nextLamp - travelled) / len
        const cx = a.x + dx * f
        const cz = a.z + dz * f
        for (const side of [-1, 1]) {
          lamps.push({ x: cx + nx * LAMP_OFFSET * side, z: cz + nz * LAMP_OFFSET * side, along: nextLamp, yaw })
        }
        nextLamp += LAMP_SPACING
      }
      travelled += len
    }
    return { segments: segs, lamps }
  }, [causeway])

  useLayoutEffect(() => {
    const mesh = lampsRef.current
    if (!mesh) return
    lamps.forEach((lamp, i) => {
      dummy.position.set(lamp.x, DECK_TOP + 0.03, lamp.z)
      dummy.rotation.set(0, lamp.yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, colour.setRGB(0.1, 0.08, 0.04))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [lamps, dummy, colour])

  useFrame(({ clock }) => {
    const mesh = lampsRef.current
    if (!mesh || !causeway) return
    const t = clock.elapsedTime
    const length = causeway.length
    // Over there nobody keeps the lamps lit
    const keep = 1 - 0.9 * hollow.amount
    const period = length + 4
    const head = (t * SPEED) % period
    // The arrival: the last stretch flashes as one when the pulse lands
    const arrival = Math.max(0, 1 - Math.abs(((t * SPEED) % period) - length) / 0.7)

    for (let i = 0; i < lamps.length; i += 1) {
      const d = head - lamps[i].along
      const pulse = d >= 0 ? Math.exp(-d * 1.15) : 0
      const nearEnd = lamps[i].along > length - 1.8 ? arrival : 0
      const level = (0.16 + pulse * 2.4 + nearEnd * 2.2) * keep
      mesh.setColorAt(i, colour.copy(WARM).multiplyScalar(level))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (!causeway || segments.length === 0) return null
  const end = causeway.points[causeway.points.length - 1]

  return (
    <group>
      {segments.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, DECK_TOP - DECK_THICKNESS / 2, s.z]}
          rotation={[0, s.yaw, 0]}
          receiveShadow
          castShadow
          raycast={() => null}
        >
          <boxGeometry args={[s.len + 0.04, DECK_THICKNESS, CAUSEWAY_HALF_WIDTH * 2]} />
          <meshStandardMaterial color="#8a867d" roughness={0.95} />
        </mesh>
      ))}
      {/* Landing beside the lighthouse */}
      <mesh position={[end.x, DECK_TOP - DECK_THICKNESS / 2, end.z]} receiveShadow raycast={() => null}>
        <cylinderGeometry args={[1.25, 1.25, DECK_THICKNESS, 20]} />
        <meshStandardMaterial color="#8a867d" roughness={0.95} />
      </mesh>

      <instancedMesh
        ref={lampsRef}
        args={[undefined, undefined, lamps.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[0.32, 0.05, 0.1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
