import { assets } from './assets'
import type { SceneObject } from '../types/scene'

/**
 * The walkable road from the bridge to the lighthouse.
 *
 * The lighthouse stands beyond the east edge of the walkable board, with the
 * river between it and everything you can reach, so on foot it simply could
 * not be got to. This is a causeway that leaves the far end of the bridge and
 * runs along the water's edge to a landing beside the lighthouse. The walk code
 * treats it as dry ground; the scene draws it with a chase of lights down it.
 *
 * It is derived from wherever the bridge and lighthouse actually are, so it
 * follows them if they are moved, and does not exist if either is missing.
 */

/** How far from the lighthouse's centre the landing sits. Outside its collider. */
const LANDING_DISTANCE = 2.5
/** Spacing of the sampled centreline. */
const STEP = 0.6
/** How far back along the bridge the walkable road reaches. */
const BRIDGE_LEAD_IN = 1.8

export const CAUSEWAY_HALF_WIDTH = 0.85
/** The walker may stray this far from the centreline before the water stops them. */
export const CAUSEWAY_WALK_HALF_WIDTH = 1.0

export interface CausewayPoint {
  x: number
  z: number
}

export interface Causeway {
  /** Centreline from the bridge's end to the landing: what is drawn. */
  points: CausewayPoint[]
  /** The same, plus a stretch back along the bridge, so the walker can get onto it. */
  walkPoints: CausewayPoint[]
  length: number
}

export function getCauseway(sceneObjects: SceneObject[]): Causeway | null {
  const bridge = sceneObjects.find((o) => o.assetId.startsWith('bridge'))
  const lighthouse = sceneObjects.find(
    (o) => assets.find((a) => a.id === o.assetId)?.kind === 'lighthouse',
  )
  if (!bridge || !lighthouse) return null

  const angle = bridge.rotation[1]
  const half = (4.6 / 2) * bridge.scale[0]
  const dx = Math.cos(angle) * half
  const dz = -Math.sin(angle) * half
  const ends: CausewayPoint[] = [
    { x: bridge.position[0] + dx, z: bridge.position[2] + dz },
    { x: bridge.position[0] - dx, z: bridge.position[2] - dz },
  ]

  const lx = lighthouse.position[0]
  const lz = lighthouse.position[2]
  // Leave from whichever end of the bridge is nearer the lighthouse
  const start = ends.sort(
    (a, b) => Math.hypot(a.x - lx, a.z - lz) - Math.hypot(b.x - lx, b.z - lz),
  )[0]

  const toStartX = start.x - lx
  const toStartZ = start.z - lz
  const len = Math.hypot(toStartX, toStartZ) || 1
  const end = {
    x: lx + (toStartX / len) * LANDING_DISTANCE,
    z: lz + (toStartZ / len) * LANDING_DISTANCE,
  }

  const total = Math.hypot(end.x - start.x, end.z - start.z)
  if (total < 1.5) return null

  const count = Math.max(2, Math.round(total / STEP))
  const points: CausewayPoint[] = []
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    points.push({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t })
  }
  // Back toward the middle of the bridge, so the walker can step onto the road
  const bx = bridge.position[0] - start.x
  const bz = bridge.position[2] - start.z
  const bl = Math.hypot(bx, bz) || 1
  const lead = { x: start.x + (bx / bl) * BRIDGE_LEAD_IN, z: start.z + (bz / bl) * BRIDGE_LEAD_IN }
  return { points, walkPoints: [lead, ...points], length: total }
}

/** True when the point is on the causeway's road, the water notwithstanding. */
export function isOnCauseway(x: number, z: number, causeway: Causeway | null) {
  if (!causeway) return false
  const pts = causeway.walkPoints
  for (let i = 0; i < pts.length - 1; i += 1) {
    const ax = pts[i].x
    const az = pts[i].z
    const bx = pts[i + 1].x
    const bz = pts[i + 1].z
    const sx = bx - ax
    const sz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz || 1)))
    if (Math.hypot(x - (ax + sx * t), z - (az + sz * t)) < CAUSEWAY_WALK_HALF_WIDTH) return true
  }
  return false
}
