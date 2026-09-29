/**
 * The Hollow: the garden as it is when nobody is remembering it.
 *
 * Not a threat and not a maze — the same ground, the same buildings, with the
 * colour and the sound taken out of it. Nothing over there chases you. The
 * feeling we are after is grief, not fear, because the one genuinely valuable
 * property this place has is that it is safe.
 *
 * State lives in a shared mutable object rather than in the store, for the
 * same reason the wind does: it is read every frame by materials, the
 * atmosphere sampler and the post-processing pass, and pushing a store update
 * per frame would re-render half the tree sixty times a second. The phase
 * changes rarely and drives UI; the amount changes continuously and drives
 * rendering.
 */

export type HollowPhase = 'garden' | 'entering' | 'hollow' | 'leaving'

/** Seconds the crossing takes in each direction. */
export const CROSSING_SECONDS = 2.4

/** Seconds you must stand on the threshold before it opens. */
export const DWELL_SECONDS = 2

export const hollow = {
  /** 0 in the garden, 1 fully across. Eased, so it settles at both ends. */
  amount: 0,
  /** The un-eased position of the crossing, kept so easing is symmetric. */
  rawAmount: 0,
  phase: 'garden' as HollowPhase,
  /** 0..1 while standing on the threshold, reset when you step off. */
  dwell: 0,
  /**
   * Whether the threshold may fire. Cleared the moment a crossing starts and
   * only restored by stepping off the medallion. Without this you arrive, keep
   * standing where you landed, the ring refills underneath you and you are
   * thrown straight back -- the gate oscillates about every 4.4 seconds for as
   * long as you stand on it.
   */
  armed: true,
}

/** Smoothstep, so the crossing eases at both ends instead of sliding. */
function ease(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/**
 * Advance the crossing. Returns true while a crossing is in progress, so
 * callers can hold input during the transition.
 */
export function advanceHollow(delta: number): boolean {
  const step = delta / CROSSING_SECONDS

  if (hollow.phase === 'entering') {
    hollow.rawAmount = Math.min(1, hollow.rawAmount + step)
    hollow.amount = ease(hollow.rawAmount)
    if (hollow.rawAmount >= 1) hollow.phase = 'hollow'
    return true
  }

  if (hollow.phase === 'leaving') {
    hollow.rawAmount = Math.max(0, hollow.rawAmount - step)
    hollow.amount = ease(hollow.rawAmount)
    if (hollow.rawAmount <= 0) hollow.phase = 'garden'
    return true
  }

  return false
}

export function beginCrossing() {
  if (hollow.phase === 'garden') hollow.phase = 'entering'
  else if (hollow.phase === 'hollow') hollow.phase = 'leaving'
  hollow.dwell = 0
  hollow.armed = false
}

/** Called when the player is clear of the threshold. */
export function rearmGate() {
  hollow.armed = true
}

/** Back to the garden with no transition — used when walk mode exits. */
export function resetHollow() {
  hollow.phase = 'garden'
  hollow.amount = 0
  hollow.rawAmount = 0
  hollow.dwell = 0
  hollow.armed = true
}
