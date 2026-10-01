import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Object3D,
  type InstancedMesh,
} from 'three'

/**
 * A mountain range that is actually terrain.
 *
 * The old backdrop was three flat ridge profiles, extruded a few units and made
 * translucent, which read as paper cut-outs and showed their slab edges when you
 * walked near them. This is one heightfield: forested foothills climbing into
 * ridged rock and snow, shaded by slope, standing in a ring round the island
 * with the east left open for the sea. It is solid, and the scene's fog does the
 * rest -- the further ranges fade into the haze, which is what distance on real
 * mountains looks like.
 */

const INNER = 27
/** The mesh starts well inside the island's edge, under the ground, so no gap shows between them. */
const GRID_INNER = 12
const OUTER = 175
const ANGLE_STEPS = 420
const RADIAL_STEPS = 84
const PEAK_HEIGHT = 36

function hash2(ix: number, iz: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, z: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

function fbm(x: number, z: number, octaves: number) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, z * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

/** Sharp-crested noise: ridges where fbm crosses its middle. */
function ridged(x: number, z: number, octaves: number) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  let weight = 1
  for (let i = 0; i < octaves; i += 1) {
    let n = 1 - Math.abs(valueNoise(x * freq, z * freq) * 2 - 1)
    n *= n
    n *= weight
    weight = Math.min(1, n * 1.6)
    sum += n * amp
    norm += amp
    amp *= 0.5
    freq *= 2.1
  }
  return sum / norm
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Height of the range at a world position. The east, toward the sea, stays low. */
function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  const angle = Math.atan2(z, x) // 0 = east
  const eastGap = Math.min(Math.abs(angle), 6.2832 - Math.abs(angle))
  // Open toward the sea, closing in over about a quarter turn
  const closed = smoothstep(0.35, 1.45, eastGap)

  // Foothills: low rolling ground just outside the island
  const foot =
    smoothstep(INNER, 46, r) * (2.2 + 5.5 * fbm(x * 0.07 + 11, z * 0.07 - 4, 4))

  // The range proper: ridged noise under a radial envelope that peaks mid-way
  const envelope = smoothstep(40, 78, r) * (1 - 0.45 * smoothstep(120, 175, r))
  const crest = 0.28 + 0.72 * ridged(x * 0.024 + 3.1, z * 0.024 - 8.2, 6)
  // A broad swell so the range has big masses as well as ridges
  const mass = 0.55 + 0.9 * fbm(x * 0.012 + 40, z * 0.012 + 9, 3)
  const range = envelope * PEAK_HEIGHT * crest * mass

  return (foot + range) * (0.08 + 0.92 * closed) - 0.12
}

const FOREST = new Color('#4a6a3c')
const MEADOW = new Color('#6f8148')
const ROCK = new Color('#857f73')
const HIGH_ROCK = new Color('#9b9a96')
const SNOW = new Color('#f3f6f8')
const SCREE = new Color('#7a6f62')

function buildGeometry() {
  const cols = ANGLE_STEPS + 1
  const rows = RADIAL_STEPS + 1
  const positions = new Float32Array(cols * rows * 3)
  const colors = new Float32Array(cols * rows * 3)
  const heights = new Float32Array(cols * rows)

  // Denser near the island, where the eye can tell
  const radiusAt = (j: number) =>
    GRID_INNER + (OUTER - GRID_INNER) * Math.pow(j / RADIAL_STEPS, 1.55)

  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const a = (i / ANGLE_STEPS) * Math.PI * 2
      const r = radiusAt(j)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const h = heightAt(x, z)
      const k = j * cols + i
      positions[k * 3] = x
      positions[k * 3 + 1] = h
      positions[k * 3 + 2] = z
      heights[k] = h
    }
  }

  // Slope from neighbouring samples, to tell cliff from meadow
  const slopeAt = (i: number, j: number) => {
    const k = j * cols + i
    const iw = (i + 1) % ANGLE_STEPS
    const jn = Math.min(RADIAL_STEPS, j + 1)
    const dx = positions[(j * cols + iw) * 3] - positions[k * 3]
    const dz = positions[(j * cols + iw) * 3 + 2] - positions[k * 3 + 2]
    const dh = heights[j * cols + iw] - heights[k]
    const ex = positions[(jn * cols + i) * 3] - positions[k * 3]
    const ez = positions[(jn * cols + i) * 3 + 2] - positions[k * 3 + 2]
    const eh = heights[jn * cols + i] - heights[k]
    const run1 = Math.hypot(dx, dz) || 1
    const run2 = Math.hypot(ex, ez) || 1
    return Math.max(Math.abs(dh) / run1, Math.abs(eh) / run2)
  }

  const c = new Color()
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const k = j * cols + i
      const h = heights[k]
      const x = positions[k * 3]
      const z = positions[k * 3 + 2]
      const slope = Math.min(1.6, slopeAt(i, j))
      const grain = fbm(x * 0.35, z * 0.35, 3)
      const patch = fbm(x * 0.05 + 70, z * 0.05, 3)

      // Altitude bands, ragged by noise so they never run level
      const band = h / PEAK_HEIGHT + (patch - 0.5) * 0.22
      c.copy(FOREST)
      c.lerp(MEADOW, smoothstep(0.1, 0.24, band) * (0.5 + 0.5 * patch))
      c.lerp(ROCK, smoothstep(0.2, 0.42, band))
      c.lerp(HIGH_ROCK, smoothstep(0.42, 0.7, band))
      // Steep ground sheds its cover and shows bare rock
      c.lerp(SCREE, smoothstep(0.55, 1.0, slope) * 0.8)
      // Snow on the high gentle ground, patchy at its edge
      const snowLine = 0.6 + (grain - 0.5) * 0.14
      c.lerp(SNOW, smoothstep(snowLine, snowLine + 0.1, band) * (1 - smoothstep(0.9, 1.5, slope) * 0.7))
      // Grain, so a slope is not one flat colour
      const shade = 0.86 + grain * 0.28
      colors[k * 3] = c.r * shade
      colors[k * 3 + 1] = c.g * shade
      colors[k * 3 + 2] = c.b * shade
    }
  }

  const indices: number[] = []
  for (let j = 0; j < RADIAL_STEPS; j += 1) {
    for (let i = 0; i < ANGLE_STEPS; i += 1) {
      const a = j * cols + i
      const b = a + 1
      const d = a + cols
      const e = d + 1
      // Wound so the faces look up and out
      indices.push(a, b, d, b, e, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return { geometry, heightOf: heightAt }
}

/** Pines scattered up the foothills, so the slopes have scale and a grain. */
function Forest() {
  const ref = useRef<InstancedMesh>(null)
  const trees = useMemo(() => {
    const out: Array<{ x: number; y: number; z: number; s: number; tint: number }> = []
    let attempts = 0
    while (out.length < 2200 && attempts < 40000) {
      attempts += 1
      const a = hash2(attempts, 1.3) * Math.PI * 2
      const r = 31 + hash2(attempts, 7.7) * 62
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const h = heightAt(x, z)
      // Treeline, and not out on the open east
      if (h < 0.3 || h > 15) continue
      // Only on gentler ground
      const e = 1.2
      const slope = Math.hypot(heightAt(x + e, z) - h, heightAt(x, z + e) - h) / e
      if (slope > 0.62) continue
      // Clumped, not uniform
      if (fbm(x * 0.09 + 5, z * 0.09, 3) < 0.46) continue
      out.push({ x, y: h, z, s: 0.7 + hash2(attempts, 3.1) * 0.8, tint: hash2(attempts, 9.9) })
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    const color = new Color()
    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + t.s * 1.4, t.z)
      dummy.scale.set(t.s * 0.8, t.s * 1.7, t.s * 0.8)
      dummy.rotation.set(0, t.tint * 6.28, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set('#2f5a31').lerp(new Color('#3d6b35'), t.tint).multiplyScalar(0.8 + t.tint * 0.35)
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [trees])

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, trees.length]}
      frustumCulled={false}
      raycast={() => null}
    >
      <coneGeometry args={[1, 3, 6]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  )
}

export function MountainRange() {
  const { geometry } = useMemo(() => buildGeometry(), [])

  return (
    <group raycast={() => null}>
      <mesh geometry={geometry} raycast={() => null} receiveShadow={false}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <Forest />
    </group>
  )
}
