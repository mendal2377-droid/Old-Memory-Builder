/**
 * Flight path and breath schedule for the Hollow dragon.
 *
 * Kept as pure functions of time, separate from the component, so the two
 * properties that matter can be checked without a renderer: that it never
 * comes near the walkable ground, and that it breathes only now and then.
 */

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Angular speed of the orbit, radians per second. */
export const ORBIT_SPEED = 0.13

/**
 * Where the dragon is at time `t`. A wide loop that wanders in and out.
 *
 * The radius matters more than it looks. The model is about 30 units across,
 * and the walkable square has corners 27 units from the centre, so an orbit
 * that dips to 38 could put it 11 units from someone standing at the edge --
 * close enough to stop being scenery and start being a threat. At 51 minimum
 * it is always a giant in the distance.
 */
export function dragonPath(t: number, out: { x: number; y: number; z: number }) {
  const a = t * ORBIT_SPEED
  const radius = 57 + Math.sin(t * 0.07) * 6
  out.x = Math.cos(a) * radius
  out.z = Math.sin(a) * radius
  out.y = 27 + Math.sin(t * 0.19) * 5 + Math.sin(t * 0.43 + 1.1) * 1.6
  return out
}

/** Seconds per breath cycle; one breath falls somewhere inside each. */
export const BREATH_CYCLE = 13

export interface Breath {
  /** True while flame is actually being emitted. */
  active: boolean
  /** 0..1 strength, swelling in and easing out. */
  intensity: number
  /** 0..1 how far the jaw is open. Opens before the flame and closes after. */
  jaw: number
}

/**
 * One breath per cycle, at a jittered moment and for a jittered length, so it
 * reads as something the creature decides to do rather than a metronome.
 */
export function breathAt(t: number): Breath {
  const cycle = Math.floor(t / BREATH_CYCLE)
  const local = t - cycle * BREATH_CYCLE
  const start = 6.5 + hash(cycle) * 4
  const duration = 1.8 + hash(cycle + 77) * 1.0

  const u = (local - start) / duration
  const active = u >= 0 && u <= 1
  const intensity = active ? Math.min(1, Math.sin(u * Math.PI) * 1.6) : 0

  // The jaw starts opening a third of a second early and closes after
  const ju = (local - start + 0.35) / (duration + 0.7)
  const jaw = ju >= 0 && ju <= 1 ? Math.min(1, Math.sin(ju * Math.PI) * 1.5) : 0

  return { active, intensity, jaw }
}
