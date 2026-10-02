import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

/**
 * Things you place grow into the world instead of appearing in it.
 *
 * A short rise from the ground with a small overshoot, so a build feels like
 * putting something down. Anything already in the scene when the page opens
 * simply is there; this only plays for what arrives afterwards (placing,
 * loading a scene, undo).
 */

const DURATION = 0.5
/** Objects mounted during the first moments after load are the opening scene. */
const OPENING_SECONDS = 3
const pageStart = typeof performance !== 'undefined' ? performance.now() : 0

function easeOutBack(t: number) {
  const c1 = 1.9
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export function PopIn({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  const age = useRef(
    typeof performance !== 'undefined' && performance.now() - pageStart < OPENING_SECONDS * 1000
      ? DURATION
      : 0,
  )

  // Fixed for the life of the component: re-applying it on a re-render would
  // snap a half-grown object back to nothing
  const startScale = useRef(age.current >= DURATION ? 1 : 0.001)

  useFrame((_, delta) => {
    const group = ref.current
    if (!group || age.current >= DURATION) return
    age.current = Math.min(DURATION, age.current + delta)
    const t = age.current / DURATION
    const k = Math.max(0.001, easeOutBack(t))
    // Rises a little taller than it is wide on the way up, then settles
    group.scale.set(k, 1 + (k - 1) * 1.25, k)
  })

  return (
    <group ref={ref} scale={startScale.current}>
      {children}
    </group>
  )
}
