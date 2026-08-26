import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Object3D,
  Vector3,
  type InstancedMesh,
} from 'three'
import { useSceneStore } from '../../store/sceneStore'

/**
 * The one finished walk: bridge to red tree, with the bench beneath it.
 *
 * Everything anchors to whatever is actually in the scene rather than to
 * hard-coded coordinates, so the route still forms if the landmarks move.
 */

function useRouteLandmarks() {
  const sceneObjects = useSceneStore((s) => s.sceneObjects)

  return useMemo(() => {
    const at = (o: (typeof sceneObjects)[number]) =>
      new Vector3(o.position[0], 0, o.position[2])

    const bridge = sceneObjects.find((o) => o.assetId.startsWith('bridge'))
    // The red tree is the twisted one; if there are several, the largest wins
    const twisted = sceneObjects
      .filter((o) => o.assetId.startsWith('twistedtree'))
      .sort((a, b) => b.scale[0] - a.scale[0])
    const redTree = twisted[0]
    const bench = sceneObjects.find((o) => o.assetId.startsWith('woodpile'))

    if (!bridge || !redTree) return null

    return {
      bridge: at(bridge),
      redTree: at(redTree),
      bench: bench ? at(bench) : null,
      redTreeScale: redTree.scale[0],
    }
  }, [sceneObjects])
}

/**
 * A curved dirt path from the bridge to the red tree, drawn as a ribbon of
 * quads along a Catmull-Rom curve so it bends rather than running straight.
 */
function PathRibbon({ curve }: { curve: CatmullRomCurve3 }) {
  const { positions, uvs, indices } = useMemo(() => {
    const steps = 90
    const halfWidth = 0.95
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      const side = new Vector3(-tan.z, 0, tan.x).normalize()
      // Taper the ends so the path fades in rather than stopping square
      const taper = Math.min(1, Math.sin(t * Math.PI) * 2.4)
      const w = halfWidth * (0.55 + taper * 0.45)

      pos.push(p.x - side.x * w, 0.035, p.z - side.z * w)
      pos.push(p.x + side.x * w, 0.035, p.z + side.z * w)
      uv.push(0, t * 12, 1, t * 12)

      if (i < steps) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }

    return {
      positions: new Float32Array(pos),
      uvs: new Float32Array(uv),
      indices: new Uint16Array(idx),
    }
  }, [curve])

  return (
    <mesh receiveShadow raycast={() => null} renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
        <bufferAttribute attach="index" args={[indices, 1]} />
      </bufferGeometry>
      <meshStandardMaterial
        color="#c9b48c"
        roughness={1}
        metalness={0}
        transparent
        opacity={0.94}
        polygonOffset
        polygonOffsetFactor={-2}
        side={DoubleSide}
      />
    </mesh>
  )
}

/** Red leaves drifting down under the canopy. */
function FallingLeaves({ centre, spread }: { centre: Vector3; spread: number }) {
  const meshRef = useRef<InstancedMesh>(null)
  const count = 90

  const seeds = useMemo(() => {
    const a = new Float32Array(count * 4)
    for (let i = 0; i < count; i += 1) {
      a[i * 4] = (Math.random() - 0.5) * spread * 2
      a[i * 4 + 1] = Math.random()
      a[i * 4 + 2] = (Math.random() - 0.5) * spread * 2
      a[i * 4 + 3] = 0.5 + Math.random() * 1.1
    }
    return a
  }, [spread])

  const tints = useMemo(() => {
    const c = new Float32Array(count * 3)
    const base = new Color('#a8202a')
    const bright = new Color('#d9463a')
    const tmp = new Color()
    for (let i = 0; i < count; i += 1) {
      tmp.copy(base).lerp(bright, Math.random())
      c[i * 3] = tmp.r
      c[i * 3 + 1] = tmp.g
      c[i * 3 + 2] = tmp.b
    }
    return c
  }, [])

  const dummy = useMemo(() => new Object3D(), [])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = clock.elapsedTime
    const top = 5.6

    for (let i = 0; i < count; i += 1) {
      const ox = seeds[i * 4]
      const phase = seeds[i * 4 + 1]
      const oz = seeds[i * 4 + 2]
      const speed = seeds[i * 4 + 3]

      // Fall, wrap, and sway sideways on the way down
      const fall = (phase + t * 0.045 * speed) % 1
      const y = top * (1 - fall)
      const sway = Math.sin(t * 0.9 * speed + phase * 12) * 0.55

      dummy.position.set(centre.x + ox + sway, y + 0.15, centre.z + oz + sway * 0.4)
      dummy.rotation.set(t * speed * 0.8 + phase * 6, t * speed * 1.1, phase * 3)
      // Fade in at the top and out at the ground so none pop mid-air
      const s =
        0.11 * Math.min(1, fall * 6) * Math.min(1, (1 - fall) * 9 + 0.15)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      raycast={() => null}
    >
      <planeGeometry args={[1, 0.72]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.9}
        side={DoubleSide}
        transparent
        opacity={0.95}
      />
      <instancedBufferAttribute
        attach="geometry-attributes-color"
        args={[tints, 3]}
      />
    </instancedMesh>
  )
}

/** A warm pool of light under the canopy, so the tree reads as the destination. */
function CanopyLight({ centre }: { centre: Vector3 }) {
  return (
    <group position={[centre.x, 0, centre.z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        raycast={() => null}
      >
        <circleGeometry args={[3.6, 28]} />
        <meshBasicMaterial
          color="#ffd9a0"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <pointLight
        position={[0, 3.2, 0]}
        color="#ffc98c"
        intensity={2.2}
        distance={11}
        decay={2}
      />
    </group>
  )
}

export function GardenRoute() {
  const marks = useRouteLandmarks()
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const settledBench = useRef(false)

  // Seat the bench under the canopy, turned toward the river, once. Guarded so
  // it never fights the player if they choose to move it somewhere else.
  useEffect(() => {
    if (settledBench.current || !marks || !marks.bench) return
    const distance = marks.bench.distanceTo(marks.redTree)
    if (distance < 4.5) {
      settledBench.current = true
      return
    }

    const objects = useSceneStore.getState().sceneObjects
    const bench = objects.find((o) => o.assetId.startsWith('woodpile'))
    if (!bench) return

    settledBench.current = true
    const seat = marks.redTree.clone().add(new Vector3(2.1, 0, 0.7))
    // River runs north-south to the east, so facing it means facing +x
    useSceneStore
      .getState()
      .updateObjectMotion(bench.id, [seat.x, 0, seat.z], [0, Math.PI / 2, 0])
  }, [marks])

  const curve = useMemo(() => {
    if (!marks) return null
    const { bridge, redTree } = marks
    // Bow the path off the straight line so it curves through the field
    const away = new Vector3(redTree.z - bridge.z, 0, -(redTree.x - bridge.x))
      .normalize()
      .multiplyScalar(3.4)
    return new CatmullRomCurve3(
      [
        bridge.clone().add(new Vector3(-1.2, 0, 0)),
        bridge.clone().lerp(redTree, 0.22).add(away.clone().multiplyScalar(0.5)),
        bridge.clone().lerp(redTree, 0.5).add(away),
        bridge.clone().lerp(redTree, 0.78).add(away.clone().multiplyScalar(0.45)),
        redTree.clone().add(new Vector3(1.8, 0, 1.2)),
      ],
      false,
      'catmullrom',
      0.5,
    )
  }, [marks])

  if (!marks || !curve) return null

  return (
    <group>
      <PathRibbon curve={curve} />
      <CanopyLight centre={marks.redTree} />
      {cameraMode === 'walk' ? (
        <FallingLeaves centre={marks.redTree} spread={2.8 * marks.redTreeScale} />
      ) : null}
    </group>
  )
}
