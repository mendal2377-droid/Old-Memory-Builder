import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
  Quaternion,
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
const HIDE_WING = '#191d21'

/** World size of the model. Its wingspan is about 4 model units (34 world). */
const SCALE = 8.5

const NECK_SEGMENTS = 9
/**
 * The tail is many small overlapping spheres. The first version used 16 with a
 * radius that fell to 0.03, so consecutive spheres stopped touching and the
 * tail read as a beaded string with a lone arrowhead on the end. Spacing here
 * is ~0.05 and the radius never drops below 0.05, so they always overlap.
 */
const TAIL_SEGMENTS = 38
const TAIL_SPIKES = 12
const FIRE_COUNT = 140

/**
 * Flame colour by age. Young flame is a white-yellow core well past 1.0 so it
 * blooms; it cools through orange to a dull red as it dies. The first version
 * drew every particle the same flat orange at 3.2x, so where they overlapped
 * -- which was everywhere -- additive blending clipped the lot to pure white.
 */
const FLAME_YOUNG = new Color(2.2, 1.1, 0.2)
const FLAME_MID = new Color(1.4, 0.4, 0.05)
const FLAME_OLD = new Color(0.5, 0.08, 0.01)

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

type V3 = [number, number, number]

// The right wing in shoulder space. The left is the same wing mirrored.
const SHOULDER: V3 = [0, 0, 0.05]
const WRIST: V3 = [0.95, 0.35, 0.1]
/** Fingertips and the scallops between them, leading edge to trailing edge. */
const FINGERS: V3[] = [
  [1.75, 0.02, -0.2],
  [1.5, -0.12, -0.85],
  [1.0, -0.15, -1.3],
  [0.45, -0.1, -1.2],
]
const SCALLOPS: V3[] = [
  [1.32, -0.05, -0.47],
  [1.07, -0.12, -0.62],
  [0.75, -0.15, -0.75],
]
const BODY_ATTACH: V3 = [0.2, -0.05, -0.8]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** Position and orientation of a thin bar running from a to b. */
function bar(a: V3, b: V3) {
  const from = new Vector3(...a)
  const to = new Vector3(...b)
  const dir = to.clone().sub(from)
  const length = dir.length()
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    dir.normalize(),
  )
  return {
    position: from.add(to).multiplyScalar(0.5).toArray() as V3,
    quaternion,
    length,
  }
}

const ARM = bar(SHOULDER, WRIST)
const FINGER_BARS = FINGERS.map((f) => bar([0, 0, 0], sub(f, WRIST)))

export function HollowDragon() {
  const rootRef = useRef<Group>(null)
  const bankRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const jawRef = useRef<Group>(null)
  const wingRefs = useRef<Array<Group | null>>([])
  const outerRefs = useRef<Array<Group | null>>([])
  const neckRefs = useRef<Array<Mesh | null>>([])
  const neckSpikeRefs = useRef<Array<Mesh | null>>([])
  const tailRefs = useRef<Array<Mesh | null>>([])
  const tailSpikeRefs = useRef<Array<Mesh | null>>([])
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
      flameColor: new Color(),
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

  const wingGeo = useMemo(() => {
    const rel = (p: V3) => sub(p, WRIST)
    // Membrane beyond the wrist, in wrist space so it can flex at the joint.
    // Fingertips alternate with scallops pulled back toward the wrist, which
    // is what gives the trailing edge its bat-wing shape.
    const outer = fan([
      [0, 0, 0],
      rel(FINGERS[0]),
      rel(SCALLOPS[0]),
      rel(FINGERS[1]),
      rel(SCALLOPS[1]),
      rel(FINGERS[2]),
      rel(SCALLOPS[2]),
      rel(FINGERS[3]),
      rel(BODY_ATTACH),
    ])
    const inner = fan([SHOULDER, WRIST, BODY_ATTACH])
    return { inner, outer }
  }, [])

  // Create the per-instance colour buffer up front. Adding it lazily in the
  // frame loop would change the material's shader defines mid-flight and force
  // a recompile at the moment of the first breath.
  useEffect(() => {
    const mesh = fireRef.current
    if (!mesh) return
    const c = new Color(1, 1, 1)
    for (let i = 0; i < FIRE_COUNT; i += 1) mesh.setColorAt(i, c)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
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
      // writes them, so left visible it draws the whole pool as unit-radius
      // additive spheres at the world origin -- a glowing orange blob in the
      // middle of the garden, all the time. Hide it, and drop any flame left
      // over so it is not replayed from stale positions on the next crossing.
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
    const { here, ahead, mouth, forward, dummy, flameColor } = scratch

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
      if (wing) wing.rotation.z = 0.14 + beat * 0.5 * flapAmp
      if (outer) outer.rotation.z = -0.12 + Math.sin(t * 1.7 - 0.95) * 0.55 * flapAmp
    }

    // Neck: an S that arches up to the head, swaying slowly
    neckRefs.current.forEach((seg, i) => {
      if (!seg) return
      const u = i / (NECK_SEGMENTS - 1)
      const x = Math.sin(t * 0.8 - u * 1.6) * 0.05 * u
      const y = 0.02 + u * 0.5 + Math.sin(u * Math.PI) * 0.16
      const z = 0.5 + u * 0.72
      seg.position.set(x, y, z)
      const spike = neckSpikeRefs.current[i]
      if (spike) spike.position.set(x, y + 0.17 - u * 0.05, z - 0.03)
    })

    // Tail: a travelling wave that grows toward the tip. The per-segment phase
    // step is small so neighbours never drift further apart than they overlap.
    tailRefs.current.forEach((seg, i) => {
      if (!seg) return
      const u = i / (TAIL_SEGMENTS - 1)
      const x = Math.sin(t * 1.15 - i * 0.16) * (0.02 + u * 0.32)
      const y = -0.03 - u * 0.05 + Math.sin(t * 0.9 - i * 0.12) * 0.03 * u
      const z = -0.6 - u * 1.95
      seg.position.set(x, y, z)
      const spike = tailSpikeRefs.current[i]
      if (spike) spike.position.set(x, y + 0.2 * (1 - u) ** 0.85 + 0.05, z)
    })

    // Breath
    const breath = breathAt(t)
    if (jawRef.current) jawRef.current.rotation.x = breath.jaw * 0.55

    const head = headRef.current
    if (head) {
      root.updateWorldMatrix(true, true)
      // Mouth and heading of the head in world space
      mouth.set(0, -0.03, 0.6)
      head.localToWorld(mouth)
      head.getWorldDirection(forward)
    }

    const points = fireRef.current
    if (points && head) {
      const d = fire.data

      if (breath.active && breath.intensity > 0.05) {
        fire.carry += delta * 95 * breath.intensity
        while (fire.carry >= 1) {
          fire.carry -= 1
          const k = (fire.next % FIRE_COUNT) * 8
          fire.next += 1
          const speed = 19 + Math.random() * 6
          d[k] = mouth.x + (Math.random() - 0.5) * 0.3
          d[k + 1] = mouth.y + (Math.random() - 0.5) * 0.3
          d[k + 2] = mouth.z + (Math.random() - 0.5) * 0.3
          d[k + 3] = forward.x * speed + (Math.random() - 0.5) * 1.8
          d[k + 4] = forward.y * speed - 1.2 + (Math.random() - 0.5) * 1.8
          d[k + 5] = forward.z * speed + (Math.random() - 0.5) * 1.8
          d[k + 6] = 0
          d[k + 7] = 0.85 + Math.random() * 0.45
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
          // Starts thin at the mouth and swells as it spreads, then thins out.
          // The first version began at 0.9 world units, as wide as the head,
          // which is why it read as a puffball sitting on the mouth.
          const size = (0.32 + 1.45 * p) * (1 - p * p) * fade
          dummy.position.set(d[k], d[k + 1], d[k + 2])
          dummy.scale.setScalar(Math.max(0, size))
          // Cool from a white-yellow core through orange to dull red
          if (p < 0.4) flameColor.copy(FLAME_YOUNG).lerp(FLAME_MID, p / 0.4)
          else flameColor.copy(FLAME_MID).lerp(FLAME_OLD, (p - 0.4) / 0.6)
          points.setColorAt(i, flameColor)
        }
        dummy.updateMatrix()
        points.setMatrixAt(i, dummy.matrix)
      }
      points.instanceMatrix.needsUpdate = true
      if (points.instanceColor) points.instanceColor.needsUpdate = true
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

  const solid = <meshBasicMaterial color={HIDE} toneMapped={false} fog={false} />

  return (
    <>
      <group ref={rootRef} visible={false} raycast={() => null}>
        <group ref={bankRef}>
          {/* Torso: chest, belly and hips as three overlapping masses */}
          <mesh position={[0, 0, 0.02]} scale={[0.36, 0.32, 0.62]} raycast={() => null}>
            <sphereGeometry args={[1, 10, 8]} />
            {solid}
          </mesh>
          <mesh position={[0, 0.03, 0.36]} scale={[0.38, 0.35, 0.4]} raycast={() => null}>
            <sphereGeometry args={[1, 10, 8]} />
            {solid}
          </mesh>
          <mesh position={[0, -0.01, -0.46]} scale={[0.3, 0.27, 0.36]} raycast={() => null}>
            <sphereGeometry args={[1, 10, 8]} />
            {solid}
          </mesh>

          {/* Spines down the back */}
          {[0.4, 0.16, -0.08, -0.32].map((z, i) => (
            <mesh
              key={`spine-${i}`}
              position={[0, 0.3 - i * 0.015, z]}
              rotation={[-0.45, 0, 0]}
              raycast={() => null}
            >
              <coneGeometry args={[0.05, 0.2, 4]} />
              {solid}
            </mesh>
          ))}

          {/* Legs, tucked: powerful hind legs, folded forelegs */}
          {[-1, 1].map((s) => (
            <group key={`legs-${s}`}>
              <mesh
                position={[s * 0.22, -0.28, -0.42]}
                rotation={[0.6, 0, s * 0.12]}
                raycast={() => null}
              >
                <boxGeometry args={[0.11, 0.36, 0.14]} />
                {solid}
              </mesh>
              <mesh
                position={[s * 0.24, -0.5, -0.56]}
                rotation={[-0.3, 0, 0]}
                raycast={() => null}
              >
                <boxGeometry args={[0.07, 0.24, 0.09]} />
                {solid}
              </mesh>
              <mesh
                position={[s * 0.2, -0.26, 0.34]}
                rotation={[-0.5, 0, s * 0.1]}
                raycast={() => null}
              >
                <boxGeometry args={[0.08, 0.26, 0.1]} />
                {solid}
              </mesh>
            </group>
          ))}

          {/* Neck, repositioned every frame, with a spine on each segment */}
          {Array.from({ length: NECK_SEGMENTS }).map((_, i) => {
            const u = i / (NECK_SEGMENTS - 1)
            return (
              <mesh
                key={`neck-${i}`}
                ref={(el) => {
                  neckRefs.current[i] = el
                }}
                scale={0.2 - u * 0.07}
                raycast={() => null}
              >
                <sphereGeometry args={[1, 8, 6]} />
                {solid}
              </mesh>
            )
          })}
          {Array.from({ length: NECK_SEGMENTS }).map((_, i) => (
            <mesh
              key={`neck-spike-${i}`}
              ref={(el) => {
                neckSpikeRefs.current[i] = el
              }}
              rotation={[-0.5, 0, 0]}
              raycast={() => null}
            >
              <coneGeometry args={[0.045, 0.17, 4]} />
              {solid}
            </mesh>
          ))}

          {/* Tail: continuous, thick at the root, fading to a point */}
          {Array.from({ length: TAIL_SEGMENTS }).map((_, i) => (
            <mesh
              key={`tail-${i}`}
              ref={(el) => {
                tailRefs.current[i] = el
              }}
              scale={Math.max(0.055, 0.23 * (1 - i / TAIL_SEGMENTS) ** 0.85)}
              raycast={() => null}
            >
              <sphereGeometry args={[1, 7, 5]} />
              {solid}
            </mesh>
          ))}
          {Array.from({ length: TAIL_SPIKES }).map((_, i) => (
            <mesh
              key={`tail-spike-${i}`}
              ref={(el) => {
                tailSpikeRefs.current[i] = el
              }}
              scale={1 - i / (TAIL_SPIKES + 3)}
              rotation={[-0.45, 0, 0]}
              raycast={() => null}
            >
              <coneGeometry args={[0.04, 0.15, 4]} />
              {solid}
            </mesh>
          ))}
          {/* Spade at the end of the tail */}
          <group position={[0, -0.08, -2.62]}>
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} raycast={() => null}>
              <coneGeometry args={[0.13, 0.42, 4]} />
              {solid}
            </mesh>
            <mesh
              position={[0, 0, 0.16]}
              rotation={[Math.PI / 2, 0, Math.PI / 4]}
              raycast={() => null}
            >
              <coneGeometry args={[0.09, 0.2, 4]} />
              {solid}
            </mesh>
          </group>

          {/* Head: heavy wedge skull, brow, jaw, swept horns, cheek spikes */}
          <group ref={headRef} position={[0, 0.6, 1.28]} rotation={[0.25, 0, 0]}>
            <mesh position={[0, 0.02, 0.02]} scale={[0.19, 0.16, 0.24]} raycast={() => null}>
              <sphereGeometry args={[1, 8, 6]} />
              {solid}
            </mesh>
            <mesh position={[0, 0.0, 0.33]} raycast={() => null}>
              <boxGeometry args={[0.17, 0.11, 0.46]} />
              {solid}
            </mesh>
            <mesh
              position={[0, -0.01, 0.6]}
              rotation={[Math.PI / 2, 0, Math.PI / 4]}
              raycast={() => null}
            >
              <coneGeometry args={[0.08, 0.14, 4]} />
              {solid}
            </mesh>
            {/* Brow ridge, which is most of what reads as a scowl */}
            <mesh position={[0, 0.1, 0.16]} rotation={[0.35, 0, 0]} raycast={() => null}>
              <boxGeometry args={[0.24, 0.05, 0.16]} />
              {solid}
            </mesh>
            <group ref={jawRef} position={[0, -0.08, 0.05]}>
              <mesh position={[0, -0.01, 0.24]} raycast={() => null}>
                <boxGeometry args={[0.14, 0.05, 0.46]} />
                {solid}
              </mesh>
            </group>
            {[-1, 1].map((s) => (
              <group key={`head-${s}`}>
                <mesh
                  position={[s * 0.1, 0.15, -0.04]}
                  rotation={[-Math.PI / 2 + 0.38, 0, -s * 0.32]}
                  raycast={() => null}
                >
                  <coneGeometry args={[0.05, 0.62, 5]} />
                  {solid}
                </mesh>
                <mesh
                  position={[s * 0.15, -0.03, -0.02]}
                  rotation={[-Math.PI / 2 + 0.1, 0, -s * 1.1]}
                  raycast={() => null}
                >
                  <coneGeometry args={[0.035, 0.22, 4]} />
                  {solid}
                </mesh>
                <mesh position={[s * 0.1, 0.08, 0.21]} raycast={() => null}>
                  <sphereGeometry args={[0.024, 6, 5]} />
                  <meshBasicMaterial color={hdr('#ffd9a8', 3)} toneMapped={false} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Wings, mirrored about the spine */}
          {[1, -1].map((side, i) => (
            <group
              key={`wing-${side}`}
              ref={(el) => {
                wingRefs.current[i] = el
              }}
              position={[side * 0.3, 0.2, 0.22]}
              scale={[side, 1, 1]}
            >
              <mesh geometry={wingGeo.inner} raycast={() => null}>
                <meshBasicMaterial color={HIDE_WING} side={DoubleSide} toneMapped={false} fog={false} />
              </mesh>
              {/* Arm: shoulder to wrist */}
              <mesh position={ARM.position} quaternion={ARM.quaternion} raycast={() => null}>
                <cylinderGeometry args={[0.05, 0.06, ARM.length, 5]} />
                {solid}
              </mesh>
              <group
                ref={(el) => {
                  outerRefs.current[i] = el
                }}
                position={WRIST}
              >
                <mesh geometry={wingGeo.outer} raycast={() => null}>
                  <meshBasicMaterial color={HIDE_WING} side={DoubleSide} toneMapped={false} fog={false} />
                </mesh>
                {/* Finger bones give the membrane its ribs */}
                {FINGER_BARS.map((b, bi) => (
                  <mesh
                    key={`finger-${bi}`}
                    position={b.position}
                    quaternion={b.quaternion}
                    raycast={() => null}
                  >
                    <cylinderGeometry args={[0.02, 0.03, b.length, 4]} />
                    {solid}
                  </mesh>
                ))}
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
          color="#ffffff"
          toneMapped={false}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>

      <pointLight ref={lightRef} color="#ff9a3c" intensity={0} distance={110} decay={2} />
    </>
  )
}
