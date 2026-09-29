import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  DoubleSide,
  type Mesh,
} from 'three'
import { hdr } from '../../data/emissive'
import {
  DWELL_SECONDS,
  advanceHollow,
  beginCrossing,
  hollow,
  rearmGate,
  resetHollow,
} from '../../data/hollow'
import { useSceneStore } from '../../store/sceneStore'
import { SITE_X, SITE_Z } from './ObservationTerrace'

/**
 * The threshold at the centre of the observation terrace.
 *
 * Standing still on the medallion closes a ring of light; when it completes,
 * the crossing begins. Requiring you to *stop* is the point — you cannot fall
 * through by walking past, and the pause is what makes arriving feel like a
 * decision rather than an accident.
 */

/** You must be inside this radius of the medallion for the ring to fill. */
const THRESHOLD_RADIUS = 1.15

const GATE_GLOW = '#8fe3ff'
const GATE_COLD = '#b9c6d6'

export function HollowGate() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const walkPose = useSceneStore((s) => s.walkPose)

  // Leaving walk mode must return you to the garden deterministically. Doing
  // this in useFrame meant it only happened if frames were still running --
  // stop the loop mid-crossing and you would be stranded half-drained.
  useEffect(() => {
    if (cameraMode !== 'walk') resetHollow()
  }, [cameraMode])

  const ringRef = useRef<Mesh>(null)
  const fillRef = useRef<Mesh>(null)
  const columnRef = useRef<Mesh>(null)

  // Rebuilt each frame from the dwell value; kept out of the store so the
  // whole tree does not re-render while the ring fills.
  const geo = useMemo(() => ({ inner: 0.58, outer: 0.82 }), [])

  useFrame((_, delta) => {
    if (cameraMode !== 'walk') {
      if (ringRef.current) ringRef.current.visible = false
      if (fillRef.current) fillRef.current.visible = false
      if (columnRef.current) columnRef.current.visible = false
      return
    }

    const crossing = advanceHollow(delta)

    // Physical position only. The earlier version folded "is a crossing in
    // progress" into this test and then re-armed in the same else branch, so
    // the gate re-armed *during* the crossing and fired again the moment it
    // landed -- the oscillation you hit by standing still.
    const nearThreshold =
      !!walkPose &&
      Math.hypot(walkPose.x - SITE_X, walkPose.z - SITE_Z) < THRESHOLD_RADIUS

    // Stepping clear is the only thing that re-arms the gate
    if (!nearThreshold) rearmGate()

    if (!crossing) {
      if (nearThreshold && hollow.armed) {
        hollow.dwell = Math.min(1, hollow.dwell + delta / DWELL_SECONDS)
        if (hollow.dwell >= 1) beginCrossing()
      } else if (!nearThreshold) {
        // Step off and the ring unwinds, faster than it filled
        hollow.dwell = Math.max(0, hollow.dwell - delta / (DWELL_SECONDS * 0.5))
      }
    }

    const lit = Math.max(hollow.dwell, crossing ? 1 : 0)

    if (ringRef.current) {
      ringRef.current.visible = lit > 0.01
      const mat = ringRef.current.material as { opacity: number }
      mat.opacity = 0.2 + lit * 0.5
      ringRef.current.rotation.z += delta * (0.25 + lit * 1.6)
    }
    if (fillRef.current) {
      fillRef.current.visible = lit > 0.01
      fillRef.current.scale.setScalar(0.2 + lit * 0.95)
      const mat = fillRef.current.material as { opacity: number }
      mat.opacity = lit * 0.32
    }
    // A shaft of light standing on the threshold during the crossing itself
    if (columnRef.current) {
      const c = crossing ? 1 - Math.abs(hollow.amount * 2 - 1) : 0
      columnRef.current.visible = c > 0.01
      columnRef.current.scale.set(1, 0.4 + c * 1.4, 1)
      const mat = columnRef.current.material as { opacity: number }
      mat.opacity = c * 0.5
    }
  })

  if (cameraMode !== 'walk') return null

  return (
    <group position={[SITE_X, 0, SITE_Z]}>
      {/* The ring that closes as you stand still */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.14, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[geo.inner, geo.outer, 48]} />
        <meshBasicMaterial
          color={hdr(GATE_GLOW)}
          toneMapped={false}
          transparent
          opacity={0.25}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Pool of light filling the medallion */}
      <mesh
        ref={fillRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.13, 0]}
        raycast={() => null}
      >
        <circleGeometry args={[0.62, 32]} />
        <meshBasicMaterial
          color={hdr(GATE_COLD, 1.6)}
          toneMapped={false}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* The shaft, brightest halfway through the crossing */}
      <mesh ref={columnRef} position={[0, 2.4, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.66, 0.8, 4.8, 20, 1, true]} />
        <meshBasicMaterial
          color={hdr(GATE_COLD, 1.4)}
          toneMapped={false}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
