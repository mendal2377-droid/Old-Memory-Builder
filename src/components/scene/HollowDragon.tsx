import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
  Vector3,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointLight,
} from 'three'
import { breathAt, dragonPath } from '../../data/dragon'
import { hdr } from '../../data/emissive'
import { hollow } from '../../data/hollow'

/**
 * A dragon circling high over the Hollow, breathing fire now and then.
 *
 * It replaces the serpent, which read as a shape rather than a creature. A
 * dragon is recognisable from its silhouette alone: horned skull, long neck,
 * bat wings, a tail that whips last.
 *
 * Everything is unlit. A dark lit material picks up the Hollow's ambient and
 * comes out mid-grey against a pale sky, which is exactly why the first
 * drifters looked like paper.
 *
 * It never turns toward the player. The flame goes out along its line of
 * flight, which by construction carries it away from the island.
 */

const HIDE = '#0e1113'
const HIDE_WING = '#171b1f'
const FIRE = '#ff8f33'

/** World size of the model. Its wingspan is about 2.6 model units. */
const SCALE = 9

const NECK_SEGMENTS = 6
const TAIL_SEGMENTS = 16
const FIRE_COUNT = 140

/** Triangle fan around the first vertex, as a flat double-sided membrane. */
function fan(points: Array<[number, number, number]>) {
  const positions: number[] = []
  for (let i = 1; i < points.length - 1; i += 1) {
    positions.push(...points[0], ...points[i], ...points[i + 1])
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

export function HollowDragon() {
  const rootRef = useRef<Group>(null)
  const bankRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const jawRef = useRef<Group>(null)
  const wingRefs = useRef<Array<Group | null>>([])
  const outerRefs = useRef<Array<Group | null>>([])
  const neckRefs = useRef<Array<Mesh | null>>([])
  const tailRefs = useRef<Array<Mesh | null>>([])
  const fireRef = useRef<InstancedMesh>(null)
  const lightRef = useRef<PointLight>(null)

  // Scratch values, allocated once
  const scratch = useMemo(
    () => ({
      here: { x: 0, y: 0, z: 0 },
      ahead: { x: 0, y: 0, z: 0 },
      mouth: new Vector3(),
      forward: new Vector3(),
      dummy: new Object3D(),
    }),
    [],
  )

  // Fire particle pool: x y z, vx vy vz, age, life
  const fire = useMemo(
    () => ({
      data: new Float32Array(FIRE_COUNT * 8),
      next: 0,
      carry: 0,
      live: false,
    }),
    [],
  )

  // Right wing, in shoulder space. The left is the same mesh mirrored.
  const wingGeo = useMemo(() => {
    const inner = fan([
      [0, 0, 0.1],
      [0.72, 0.14, 0.02],
      [0.16, -0.02, -0.72],
    ])
    // Outer wing, in wrist space so it can flex at the joint
    const outer = fan([
      [0, 0, 0],
      [0.55, -0.14, -0.38],
      [0.34, -0.16, -0.8],
      [0.02, -0.16, -1.02],
      [-0.56, -0.16, -0.74],
    ])
    return { inner, outer }
  }, [])

  useFrame(({ clock }, delta) => {
    const root = rootRef.current
    if (!root) return

    const h = hollow.amount
    root.visible = h > 0.06
    const light = lightRef.current
    const flame = fireRef.current
    if (h <= 0.06) {
      if (light) light.intensity = 0
      // An InstancedMesh starts with identity matrices, and this branch never
      // writes them, so left visible it draws 90 unit-radius additive spheres
      // at the world origin -- a glowing orange blob in the middle of the
      // garden, all the time. Hide it, and drop any flame left over so it is
      // not replayed from stale positions on the next crossing.
      if (flame) flame.visible = false
      if (fire.live) {
        fire.data.fill(0)
        fire.live = false
      }
      return
    }
    if (flame) flame.visible = true
    fire.live = true

    const t = clock.elapsedTime
    const fade = Math.min(1, (h - 0.06) / 0.5)
    const { here, ahead, mouth, forward, dummy } = scratch

    // Position and heading along the orbit
    dragonPath(t, here)
    dragonPath(t + 0.35, ahead)
    root.position.set(here.x, here.y, here.z)
    root.lookAt(ahead.x, ahead.y, ahead.z)
    root.scale.setScalar(SCALE * fade)
    // Bank into the turn, and rock a little with each wingbeat
    if (bankRef.current) {
      bankRef.current.rotation.z = 0.3 + Math.sin(t * 1.3) * 0.05
    }

    // Wings. Long glides alternate with runs of heavy beats, and the outer
    // wing trails the inner so the tip whips instead of hinging stiffly.
    const flapAmp = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(t * 0.23))
    const beat = Math.sin(t * 1.7)
    for (let side = 0; side < 2; side += 1) {
      const wing = wingRefs.current[side]
      const outer = outerRefs.current[side]
      if (wing) wing.rotation.z = beat * 0.55 * flapAmp - 0.02
      if (outer) outer.rotation.z = Math.sin(t * 1.7 - 0.95) * 0.5 * flapAmp
    }

    // Neck arches and sways; tail follows a travelling wave that grows to the tip
    neckRefs.current.forEach((seg, i) => {
      if (!seg) return
      const u = i / (NECK_SEGMENTS - 1)
      seg.position.set(
        Math.sin(t * 0.8 - u * 1.4) * 0.04 * u,
        0.1 + u * 0.32 + Math.sin(u * Math.PI) * 0.12,
        0.55 + u * 0.55,
      )
    })
    tailRefs.current.forEach((seg, i) => {
      if (!seg) return
      const u = i / (TAIL_SEGMENTS - 1)
      seg.position.set(
        Math.sin(t * 1.15 - i * 0.42) * (0.02 + u * 0.28),
        -0.02 - u * 0.05 + Math.sin(t * 0.9 - i * 0.3) * 0.02 * u,
        -0.5 - u * 1.7,
      )
    })

    // Breath
    const breath = breathAt(t)
    if (jawRef.current) jawRef.current.rotation.x = breath.jaw * 0.5

    const head = headRef.current
    if (head) {
      root.updateWorldMatrix(true, true)
      // Mouth and heading of the head in world space
      mouth.set(0, -0.03, 0.62)
      head.localToWorld(mouth)
      head.getWorldDirection(forward)
    }

    const points = fireRef.current
    if (points && head) {
      const d = fire.data

      if (breath.active && breath.intensity > 0.05) {
        fire.carry += delta * 75 * breath.intensity
        while (fire.carry >= 1) {
          fire.carry -= 1
          const k = (fire.next % FIRE_COUNT) * 8
          fire.next += 1
          const speed = 13 + Math.random() * 4.5
          d[k] = mouth.x + (Math.random() - 0.5) * 0.6
          d[k + 1] = mouth.y + (Math.random() - 0.5) * 0.6
          d[k + 2] = mouth.z + (Math.random() - 0.5) * 0.6
          d[k + 3] = forward.x * speed + (Math.random() - 0.5) * 3
          d[k + 4] = forward.y * speed - 1.6 + (Math.random() - 0.5) * 3
          d[k + 5] = forward.z * speed + (Math.random() - 0.5) * 3
          d[k + 6] = 0
          d[k + 7] = 0.9 + Math.random() * 0.55
        }
      }

      for (let i = 0; i < FIRE_COUNT; i += 1) {
        const k = i * 8
        const life = d[k + 7]
        if (life <= 0 || d[k + 6] >= life) {
          dummy.scale.setScalar(0)
        } else {
          d[k + 6] += delta
          const p = d[k + 6] / life
          // Flame slows, rises a little as it burns, then falls away
          d[k + 3] *= 1 - 0.55 * delta
          d[k + 4] += (p < 0.5 ? 1.2 : -2.6) * delta
          d[k + 5] *= 1 - 0.55 * delta
          d[k] += d[k + 3] * delta
          d[k + 1] += d[k + 4] * delta
          d[k + 2] += d[k + 5] * delta
          // Swells as it spreads, then thins out
          const size = (0.9 + 3.0 * p) * (1 - p * p) * fade
          dummy.position.set(d[k], d[k + 1], d[k + 2])
          dummy.scale.setScalar(Math.max(0, size))
        }
        dummy.updateMatrix()
        points.setMatrixAt(i, dummy.matrix)
      }
      points.instanceMatrix.needsUpdate = true
    }

    // Firelight thrown ahead of the mouth, flickering
    if (light) {
      const flicker = 0.75 + Math.random() * 0.5
      light.intensity = breath.intensity * 520 * flicker * fade
      light.position.set(
        mouth.x + forward.x * 7,
        mouth.y + forward.y * 7,
        mouth.z + forward.z * 7,
      )
    }
  })

  return (
    <>
      <group ref={rootRef} visible={false} raycast={() => null}>
        <group ref={bankRef}>
          {/* Torso and chest */}
          <mesh scale={[0.3, 0.28, 0.62]} raycast={() => null}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color={HIDE} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.02, 0.32]} scale={[0.32, 0.3, 0.36]} raycast={() => null}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color={HIDE} toneMapped={false} />
          </mesh>

          {/* Neck, repositioned every frame */}
          {Array.from({ length: NECK_SEGMENTS }).map((_, i) => (
            <mesh
              key={`neck-${i}`}
              ref={(el) => {
                neckRefs.current[i] = el
              }}
              scale={0.19 - (i / (NECK_SEGMENTS - 1)) * 0.06}
              raycast={() => null}
            >
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color={HIDE} toneMapped={false} />
            </mesh>
          ))}

          {/* Tail, tapering to a point */}
          {Array.from({ length: TAIL_SEGMENTS }).map((_, i) => (
            <mesh
              key={`tail-${i}`}
              ref={(el) => {
                tailRefs.current[i] = el
              }}
              scale={Math.max(0.03, 0.2 * (1 - i / TAIL_SEGMENTS) ** 1.1)}
              raycast={() => null}
            >
              <sphereGeometry args={[1, 7, 5]} />
              <meshBasicMaterial color={HIDE} toneMapped={false} />
            </mesh>
          ))}
          {/* Spade at the end of the tail */}
          <mesh position={[0, -0.07, -2.32]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <coneGeometry args={[0.1, 0.34, 4]} />
            <meshBasicMaterial color={HIDE} toneMapped={false} />
          </mesh>

          {/* Head: skull, jaw, horns and eyes */}
          <group ref={headRef} position={[0, 0.5, 1.14]} rotation={[0.1, 0, 0]}>
            <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
              <coneGeometry args={[0.15, 0.64, 5]} />
              <meshBasicMaterial color={HIDE} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.06, 0.02]} scale={[0.17, 0.15, 0.2]} raycast={() => null}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color={HIDE} toneMapped={false} />
            </mesh>
            <group ref={jawRef} position={[0, -0.07, 0.04]}>
              <mesh position={[0, 0, 0.24]} raycast={() => null}>
                <boxGeometry args={[0.15, 0.05, 0.5]} />
                <meshBasicMaterial color={HIDE} toneMapped={false} />
              </mesh>
            </group>
            {[-1, 1].map((s) => (
              <mesh
                key={`horn-${s}`}
                position={[s * 0.075, 0.13, -0.05]}
                rotation={[-Math.PI / 2 + 0.5, 0, s * 0.18]}
                raycast={() => null}
              >
                <coneGeometry args={[0.035, 0.36, 5]} />
                <meshBasicMaterial color={HIDE} toneMapped={false} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={`eye-${s}`} position={[s * 0.09, 0.07, 0.14]} raycast={() => null}>
                <sphereGeometry args={[0.02, 6, 5]} />
                <meshBasicMaterial color={hdr('#ffd9a8', 3)} toneMapped={false} />
              </mesh>
            ))}
          </group>

          {/* Wings, mirrored about the spine */}
          {[1, -1].map((side, i) => (
            <group
              key={`wing-${side}`}
              ref={(el) => {
                wingRefs.current[i] = el
              }}
              position={[side * 0.26, 0.16, 0.28]}
              scale={[side, 1, 1]}
            >
              <mesh geometry={wingGeo.inner} raycast={() => null}>
                <meshBasicMaterial color={HIDE_WING} side={DoubleSide} toneMapped={false} />
              </mesh>
              {/* Leading arm */}
              <mesh
                position={[0.36, 0.07, 0.06]}
                rotation={[0, 0, Math.atan2(0.14, 0.72)]}
                raycast={() => null}
              >
                <boxGeometry args={[0.76, 0.05, 0.05]} />
                <meshBasicMaterial color={HIDE} toneMapped={false} />
              </mesh>
              <group
                ref={(el) => {
                  outerRefs.current[i] = el
                }}
                position={[0.72, 0.14, 0.02]}
              >
                <mesh geometry={wingGeo.outer} raycast={() => null}>
                  <meshBasicMaterial color={HIDE_WING} side={DoubleSide} toneMapped={false} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>

      {/* Flame, in world space so it hangs in the air behind the dragon */}
      <instancedMesh
        ref={fireRef}
        args={[undefined, undefined, FIRE_COUNT]}
        visible={false}
        frustumCulled={false}
        raycast={() => null}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={hdr(FIRE, 3.2)}
          toneMapped={false}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>

      <pointLight ref={lightRef} color="#ff9a3c" intensity={0} distance={110} decay={2} />
    </>
  )
}
