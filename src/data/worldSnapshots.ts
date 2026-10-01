/**
 * Full-colour stills of the garden, taken just as you go through the
 * lighthouse door, for the screens in the room beyond it.
 *
 * The room is its own Canvas and cannot see the diorama's scene, so the
 * diorama photographs itself first (see WorldSnapshotter) and leaves the
 * frames here.
 */
export interface WorldSnapshot {
  canvas: HTMLCanvasElement
  label: string
}

export const worldSnapshots: { frames: WorldSnapshot[] } = { frames: [] }

let snapshotter: (() => void) | null = null

/** Called by the diorama's Canvas so that something is able to take the photos. */
export function registerSnapshotter(fn: (() => void) | null) {
  snapshotter = fn
}

/** Synchronous: when this returns, worldSnapshots holds fresh frames (or the old ones). */
export function captureWorldSnapshots() {
  try {
    snapshotter?.()
  } catch {
    // The screens fall back to their other feeds
  }
}
