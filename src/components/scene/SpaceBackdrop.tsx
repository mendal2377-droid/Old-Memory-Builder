import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  ConeGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Matrix4,
  Object3D,
  type BufferGeometry,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three'

/**
 * Deep Space: the diorama as an island torn loose and left adrift.
 *
 * The look leans on one rule — everything solid is very dark rock, and the
 * only bright things are light itself (engines, veins, the core, stars). That
 * contrast is what makes a floating island read as vast rather than flat.
 */

const ROCK = '#12162a'
const ROCK_LIT = '#232a44'
const GLOW = '#39d8ff'
const GLOW_DIM = '#1b6f9c'

// -- Shared helpers ----------------------------------------------------------

/** Roughen a geometry so rock reads as broken stone, not a clean primitive. */
function jitter(geometry: BufferGeometry, amount: number, seedScale = 1) {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const n =
      Math.sin(x * 12.9898 * seedScale + y * 78.233 + z * 37.719) * 43758.5453
    const d = (n - Math.floor(n) - 0.5) * amount
    // Leave the top ring alone so caps still meet their keels
    const protect = y > 0.9 ? 0.25 : 1
    pos.setXYZ(i, x + d * protect, y + d * 0.55 * protect, z + d * protect)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// -- Nebula ------------------------------------------------------------------

/**
 * The nebula lives on a shell, not on billboards.
 *
 * Billboard planes need their edges feathered, and a radial feather on a plane
 * that covers 40 degrees of sky reads as a giant translucent ball — four of
 * them looked like planets parked around the island. A sphere has no edge to
 * hide, so the gas can be as bright as it likes.
 */
let nebulaShell: CanvasTexture | null = null
function getNebulaTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (nebulaShell) return nebulaShell

  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  // Wrap-safe stroke: anything drawn near an edge is repeated on the other
  // side, so the shell has no visible seam behind the diorama.
  const wrapped = (draw: (offset: number) => void) => {
    draw(0)
    draw(-w)
    draw(w)
  }

  // The reference's gas is filaments, not clouds: thin bright veins of
  // electric blue with a soft haze behind them.
  const veins = 150
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = 'lighter'

  // Haze first — broad, dim, banded across the middle latitudes
  for (let i = 0; i < 34; i += 1) {
    const cy = h * (0.2 + Math.random() * 0.6)
    const cx = Math.random() * w
    const rx = 90 + Math.random() * 210
    const ry = 40 + Math.random() * 90
    wrapped((ox) => {
      const g = ctx.createRadialGradient(cx + ox, cy, 0, cx + ox, cy, rx)
      g.addColorStop(0, `rgba(38,96,190,${0.1 + Math.random() * 0.12})`)
      g.addColorStop(0.5, 'rgba(20,52,130,0.05)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.save()
      ctx.translate(cx + ox, cy)
      ctx.scale(1, ry / rx)
      ctx.beginPath()
      ctx.arc(0, 0, rx, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }

  // Then the veins themselves
  for (let i = 0; i < veins; i += 1) {
    const bright = Math.random()
    ctx.strokeStyle =
      bright > 0.86
        ? `rgba(190,235,255,${0.5 + Math.random() * 0.4})`
        : bright > 0.5
          ? `rgba(70,175,255,${0.3 + Math.random() * 0.35})`
          : `rgba(30,95,215,${0.2 + Math.random() * 0.3})`
    ctx.lineWidth = bright > 0.86 ? 0.8 + Math.random() * 1.4 : 1.5 + Math.random() * 4
    const startX = Math.random() * w
    // Cluster toward the middle latitudes; poles get very little
    const startY = h * (0.15 + Math.pow(Math.random(), 0.8) * 0.7)
    const dir = (Math.random() - 0.5) * 1.5 + (Math.random() > 0.5 ? 0 : Math.PI)
    const segs = 5 + Math.floor(Math.random() * 9)
    const step = 12 + Math.random() * 40
    wrapped((ox) => {
      let x = startX + ox
      let y = startY
      let d = dir
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < segs; s += 1) {
        d += (Math.random() - 0.5) * 0.7
        const nx = x + Math.cos(d) * step
        const ny = y + Math.sin(d) * step * 0.45
        ctx.quadraticCurveTo(x + Math.cos(d) * step * 0.5, y, nx, ny)
        x = nx
        y = ny
      }
      ctx.stroke()
    })
  }

  // Stars caught in the gas
  for (let i = 0; i < 1400; i += 1) {
    const s = Math.random()
    ctx.fillStyle = `rgba(225,240,255,${0.2 + Math.random() * 0.75})`
    const size = s > 0.97 ? 2 : 1
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size)
  }
  ctx.globalCompositeOperation = 'source-over'

  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  nebulaShell = tex
  return tex
}

/**
 * A shell of gas surrounding everything. Slowly turning, so the sky drifts
 * without any single feature ever crossing an edge.
 */
function Nebula() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.004
  })

  return (
    <mesh ref={meshRef} renderOrder={-940}>
      <sphereGeometry args={[132, 48, 32]} />
      <meshBasicMaterial
        map={getNebulaTexture()}
        transparent
        opacity={0.85}
        side={BackSide}
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
        fog={false}
      />
    </mesh>
  )
}

// -- Moons -------------------------------------------------------------------

function makeMoonTexture(base: string, crater: string) {
  const w = 256
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 150; i += 1) {
    const r = 1.5 + Math.pow(Math.random(), 2) * 16
    const x = Math.random() * w
    const y = Math.random() * h
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, crater)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

let moonTexA: CanvasTexture | null = null
let moonTexB: CanvasTexture | null = null

/** Cratered moons, lit for real so the terminator lands where the star is. */
function Moons() {
  const textures = useMemo(() => {
    if (typeof document === 'undefined') return { a: null, b: null }
    moonTexA = moonTexA ?? makeMoonTexture('#9aa4b4', 'rgba(72,80,96,0.85)')
    moonTexB = moonTexB ?? makeMoonTexture('#8590a4', 'rgba(58,66,84,0.8)')
    return { a: moonTexA, b: moonTexB }
  }, [])

  return (
    <group>
      <group position={[-78, 40, -92]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[26, 56, 40]} />
          <meshStandardMaterial
            map={textures.a}
            roughness={1}
            metalness={0}
            // Enough self-lift that the unlit limb keeps its craters. At pure
            // black the terminator becomes a straight edge and the moon reads
            // as a paper half-disc rather than a sphere.
            emissive="#3d4a63"
            emissiveIntensity={1.15}
            fog={false}
          />
        </mesh>
        <mesh renderOrder={-881}>
          <sphereGeometry args={[28, 32, 24]} />
          <meshBasicMaterial
            color="#5c8fd6"
            transparent
            opacity={0.1}
            side={BackSide}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>

      <group position={[88, 30, -70]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[10, 44, 30]} />
          <meshStandardMaterial
            map={textures.b}
            roughness={1}
            metalness={0}
            emissive="#2b3648"
            emissiveIntensity={0.95}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// -- Drifting islands --------------------------------------------------------

/** Sister islands: dark broken rock with glowing veins, each on its own bob. */
function FloatingIslands() {
  const geometries = useMemo(() => {
    const keel = jitter(new ConeGeometry(0.95, 2.4, 9, 6), 0.42, 1)
    const cap = jitter(new ConeGeometry(1.05, 0.4, 10, 2), 0.2, 2.3)
    return { keel, cap }
  }, [])

  const islands = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.7
        const radius = 56 + Math.random() * 62
        // Keep them out of the eye-level band. An island sitting on the
        // horizon is seen edge-on and reads as a grey blade, not a rock.
        const above = i % 2 === 0
        const y = above ? 20 + Math.random() * 34 : -34 - Math.random() * 22
        return {
          x: Math.cos(angle) * radius,
          y,
          z: Math.sin(angle) * radius,
          scale: 6 + Math.random() * 13,
          // Tip the face toward the viewer so the cap is visible, not the rim
          tilt: (above ? 0.34 : -0.34) + (Math.random() - 0.5) * 0.3,
          spin: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          bob: 0.5 + Math.random() * 1.5,
          veins: 2 + Math.floor(Math.random() * 3),
        }
      }),
    [],
  )
  const refs = useRef<Array<Group | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    islands.forEach((isle, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.y = isle.y + Math.sin(t * 0.17 + isle.phase) * isle.bob
      g.rotation.y = isle.spin + t * 0.01
    })
  })

  return (
    <group>
      {islands.map((isle, i) => (
        <group
          key={`isle-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={[isle.x, isle.y, isle.z]}
          rotation={[isle.tilt, isle.spin, isle.tilt * 0.6]}
          scale={isle.scale}
        >
          {/* Thin band of soil; most of the mass is rock */}
          <mesh geometry={geometries.cap} position={[0, 0.12, 0]}>
            <meshStandardMaterial
              color="#43614a"
              roughness={1}
              emissive="#101d16"
              emissiveIntensity={0.9}
            />
          </mesh>
          {/* Dark broken keel */}
          <mesh
            geometry={geometries.keel}
            position={[0, -1.15, 0]}
            rotation={[Math.PI, 0, 0]}
          >
            <meshStandardMaterial
              color={ROCK}
              roughness={1}
              emissive="#060a14"
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Glowing veins threading the underside */}
          {Array.from({ length: isle.veins }).map((_, v) => {
            const a = (v / isle.veins) * Math.PI * 2 + i
            return (
              <mesh
                key={`vein-${v}`}
                position={[Math.cos(a) * 0.4, -0.9, Math.sin(a) * 0.4]}
                rotation={[0, -a, 0.2]}
                scale={[0.05, 1.1, 0.05]}
              >
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial
                  color={GLOW}
                  transparent
                  opacity={0.75}
                  depthWrite={false}
                  blending={AdditiveBlending}
                />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

// -- Asteroid debris ---------------------------------------------------------

/**
 * Debris. Kept few and large on purpose — a rock that covers three pixels has
 * no silhouette left, so a hundred of them just stipple the sky with grey
 * squares. Better to have forty you can actually read as stone.
 */
function AsteroidField() {
  const meshRef = useRef<InstancedMesh>(null)
  const count = 44
  const geometry = useMemo(
    () => jitter(new DodecahedronGeometry(1, 0), 0.42, 4.1),
    [],
  )
  const rocks = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(count * 16)
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = 40 + Math.random() * 62
      // Size with distance so everything subtends roughly the same angle
      const spread = (r - 40) / 62
      dummy.position.set(
        Math.cos(a) * r,
        -24 + Math.random() * 62,
        Math.sin(a) * r,
      )
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      dummy.scale.setScalar((1.1 + Math.random() * 2.6) * (0.8 + spread * 0.9))
      dummy.updateMatrix()
      dummy.matrix.toArray(matrices, i * 16)
    }
    return matrices
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || mesh.userData.filled) return
    const m = new Matrix4()
    for (let i = 0; i < count; i += 1) {
      m.fromArray(rocks, i * 16)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.userData.filled = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      raycast={() => null}
    >
      <meshStandardMaterial
        color={ROCK_LIT}
        roughness={1}
        emissive="#05080f"
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  )
}

// -- Traffic -----------------------------------------------------------------

/**
 * Ships keep their distance and stay dark, so only their engines read at
 * range — pale and close, they looked like flying cigars.
 */
function PassingShips() {
  const ships = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => {
        const heavy = i % 4 === 0
        return {
          heavy,
          period: heavy ? 80 + Math.random() * 50 : 30 + Math.random() * 26,
          offset: Math.random() * 70,
          height: 10 + Math.random() * 44,
          depth: -58 - Math.random() * 60,
          span: 230,
          scale: heavy ? 3.6 + Math.random() * 2.4 : 1.1 + Math.random() * 1.2,
          tilt: (Math.random() - 0.5) * 0.3,
          reverse: i % 2 === 0,
        }
      }),
    [],
  )
  const refs = useRef<Array<Group | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ships.forEach((ship, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = ((t + ship.offset) % ship.period) / ship.period
      const travel = ship.reverse ? 1 - p : p
      g.position.set(
        -ship.span / 2 + travel * ship.span,
        ship.height + Math.sin(t * 0.3 + i) * 0.4,
        ship.depth,
      )
      g.rotation.set(0, ship.reverse ? Math.PI : 0, ship.tilt)
    })
  })

  return (
    <group>
      {ships.map((ship, i) => (
        <group
          key={`ship-${i}`}
          ref={(el) => {
            refs.current[i] = el
          }}
          scale={ship.scale}
        >
          {/* Dark hull — a silhouette, not a highlight */}
          <mesh>
            <boxGeometry args={ship.heavy ? [5.2, 0.7, 1.3] : [2.2, 0.26, 0.5]} />
            <meshStandardMaterial
              color="#39435f"
              roughness={0.85}
              emissive="#161d2e"
              emissiveIntensity={1}
              fog={false}
            />
          </mesh>
          <mesh position={ship.heavy ? [-1.3, 0.45, 0] : [-0.3, 0, 0]}>
            <boxGeometry args={ship.heavy ? [1.8, 0.45, 0.8] : [0.9, 0.09, 1.6]} />
            <meshStandardMaterial
              color="#4b5674"
              roughness={0.8}
              emissive="#1b2337"
              emissiveIntensity={1}
              fog={false}
            />
          </mesh>
          {/* Running light */}
          <mesh position={[ship.heavy ? 2.4 : 1.0, 0, 0]}>
            <sphereGeometry args={[ship.heavy ? 0.14 : 0.07, 8, 8]} />
            <meshBasicMaterial color="#ff5a6e" toneMapped={false} fog={false} />
          </mesh>
          {/* Engine glow. Short and small: a long bright plume turns the ship
              into a comet, and the hull stops being what you notice. */}
          <mesh position={[ship.heavy ? -2.8 : -1.18, 0, 0]}>
            <sphereGeometry args={[ship.heavy ? 0.24 : 0.11, 10, 10]} />
            <meshBasicMaterial
              color={GLOW}
              transparent
              opacity={0.85}
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </mesh>
          <mesh
            position={[ship.heavy ? -3.5 : -1.55, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry
              args={[
                ship.heavy ? 0.2 : 0.09,
                ship.heavy ? 1.5 : 0.75,
                10,
                1,
                true,
              ]}
            />
            <meshBasicMaterial
              color={GLOW_DIM}
              transparent
              opacity={0.16}
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// -- The island's own core ---------------------------------------------------

/**
 * A reactor slung beneath the board. This is what sells the diorama as the
 * biggest island out here, rather than ground that happens to stop.
 */
function IslandCore() {
  const glowRef = useRef<Mesh>(null)
  const ringRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glowRef.current) {
      const m = glowRef.current.material as { opacity: number }
      m.opacity = 0.5 + Math.sin(t * 0.9) * 0.16
    }
    if (ringRef.current) ringRef.current.rotation.z += 0.004
  })

  return (
    <group position={[0, -3.2, 0]}>
      {/* Rock keel under the board */}
      <mesh position={[0, -3.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[17, 12, 12, 3]} />
        <meshStandardMaterial
          color={ROCK}
          roughness={1}
          emissive="#060a14"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Reactor housing */}
      <mesh position={[0, -8.5, 0]}>
        <cylinderGeometry args={[2.6, 3.6, 5, 12]} />
        <meshStandardMaterial
          color="#1d2438"
          roughness={1}
          emissive="#0a1424"
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* Core light */}
      <mesh ref={glowRef} position={[0, -10.6, 0]}>
        <sphereGeometry args={[2.6, 24, 20]} />
        <meshBasicMaterial
          color={GLOW}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -10.6, 0]}>
        <sphereGeometry args={[1.3, 20, 16]} />
        <meshBasicMaterial color="#cdf4ff" toneMapped={false} />
      </mesh>
      {/* Halo ring */}
      <mesh ref={ringRef} position={[0, -6.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 9.5, 48]} />
        <meshBasicMaterial
          color={GLOW_DIM}
          transparent
          opacity={0.18}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {/* Light spilling onto the underside */}
      <pointLight
        position={[0, -9, 0]}
        color={GLOW}
        intensity={7}
        distance={40}
        decay={1.7}
      />
    </group>
  )
}

// -- Rim installations -------------------------------------------------------

/** A point on the square board edge, plus the outward direction there. */
function rimPoint(t: number, half: number) {
  const p = ((t % 1) + 1) % 1
  const side = Math.floor(p * 4)
  const f = p * 4 - side
  const a = -half + f * half * 2
  switch (side) {
    case 0:
      return { x: a, z: -half, nx: 0, nz: -1, yaw: 0 }
    case 1:
      return { x: half, z: a, nx: 1, nz: 0, yaw: Math.PI / 2 }
    case 2:
      return { x: -a, z: half, nx: 0, nz: 1, yaw: Math.PI }
    default:
      return { x: -half, z: -a, nx: -1, nz: 0, yaw: -Math.PI / 2 }
  }
}

/**
 * Skyline spires clustered around the island's edge.
 *
 * The reference builds these in groups of two to four slender towers with
 * antenna arrays, not as an even fence of blockhouses — clusters leave gaps
 * you can see the sky through, which is what keeps the rim from walling the
 * diorama in.
 */
function RimInstallations() {
  const clusters = useMemo(() => {
    const half = 22.5
    const groups = 9
    return Array.from({ length: groups }).map((_, g) => {
      const t = g / groups + (Math.random() - 0.5) * 0.05
      const p = rimPoint(t, half)
      const towers = Array.from({ length: 2 + Math.floor(Math.random() * 3) }).map(
        () => {
          const h = 7 + Math.pow(Math.random(), 1.3) * 15
          return {
            // Spread along the rim edge and slightly outboard of it
            along: (Math.random() - 0.5) * 7,
            out: 0.6 + Math.random() * 3,
            h,
            w: 0.5 + Math.random() * 0.55,
            // Windows sit in horizontal registers, like floors
            floors: 3 + Math.floor(Math.random() * 5),
            masts: 1 + Math.floor(Math.random() * 3),
            mastH: 2 + Math.random() * 4.5,
            hasBeacon: Math.random() > 0.55,
            phase: Math.random() * Math.PI * 2,
          }
        },
      )
      return { p, towers }
    })
  }, [])

  const lightRefs = useRef<Array<Mesh | null>>([])
  const phases = useMemo(
    () => clusters.flatMap((c) => c.towers.map((t) => t.phase)),
    [clusters],
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    lightRefs.current.forEach((m, i) => {
      if (!m) return
      const mat = m.material as { opacity: number }
      mat.opacity = 0.35 + Math.abs(Math.sin(t * 0.9 + phases[i])) * 0.6
    })
  })

  let beaconIndex = 0

  return (
    <group>
      {clusters.map((cluster, g) => {
        const { p } = cluster
        // Along-edge direction is the outward normal turned 90 degrees
        const ax = -p.nz
        const az = p.nx
        return (
          <group key={`cluster-${g}`}>
            {cluster.towers.map((tw, j) => {
              const x = p.x + ax * tw.along + p.nx * tw.out
              const z = p.z + az * tw.along + p.nz * tw.out
              const myBeacon = tw.hasBeacon ? beaconIndex++ : -1
              return (
                <group key={`tw-${j}`} position={[x, 0, z]} rotation={[0, p.yaw, 0]}>
                  {/* Base plinth */}
                  <mesh position={[0, 0.35, 0]}>
                    <boxGeometry args={[tw.w * 2.4, 0.7, tw.w * 2.4]} />
                    <meshStandardMaterial color="#2b3145" roughness={0.9} />
                  </mesh>
                  {/* Lower shaft */}
                  <mesh position={[0, tw.h * 0.32, 0]}>
                    <boxGeometry args={[tw.w * 1.25, tw.h * 0.64, tw.w * 1.25]} />
                    <meshStandardMaterial
                      color="#39415c"
                      roughness={0.75}
                      metalness={0.25}
                    />
                  </mesh>
                  {/* Upper shaft, stepped in */}
                  <mesh position={[0, tw.h * 0.8, 0]}>
                    <boxGeometry args={[tw.w * 0.8, tw.h * 0.34, tw.w * 0.8]} />
                    <meshStandardMaterial
                      color="#454e6c"
                      roughness={0.7}
                      metalness={0.3}
                    />
                  </mesh>
                  {/* Window registers on all four faces */}
                  {Array.from({ length: tw.floors }).map((_, f) => {
                    const y = tw.h * (0.12 + (f / tw.floors) * 0.62)
                    return [0, 1, 2, 3].map((face) => (
                      <mesh
                        key={`w-${f}-${face}`}
                        position={[
                          face === 0 ? tw.w * 0.64 : face === 2 ? -tw.w * 0.64 : 0,
                          y,
                          face === 1 ? tw.w * 0.64 : face === 3 ? -tw.w * 0.64 : 0,
                        ]}
                        rotation={[0, (face * Math.PI) / 2 + Math.PI / 2, 0]}
                      >
                        <planeGeometry args={[tw.w * 0.85, tw.h * 0.035]} />
                        <meshBasicMaterial
                          color={GLOW}
                          transparent
                          opacity={0.75}
                          side={DoubleSide}
                          depthWrite={false}
                          blending={AdditiveBlending}
                        />
                      </mesh>
                    ))
                  })}
                  {/* Antenna array on the crown */}
                  {Array.from({ length: tw.masts }).map((_, m) => {
                    const off = (m - (tw.masts - 1) / 2) * tw.w * 0.5
                    const mh = tw.mastH * (m === 0 ? 1 : 0.6 + Math.random() * 0.3)
                    return (
                      <mesh
                        key={`m-${m}`}
                        position={[off, tw.h * 0.97 + mh / 2, 0]}
                      >
                        <cylinderGeometry args={[0.025, 0.06, mh, 5]} />
                        <meshStandardMaterial
                          color="#5a6480"
                          roughness={0.8}
                          metalness={0.4}
                        />
                      </mesh>
                    )
                  })}
                  {/* Aircraft-warning beacon */}
                  {myBeacon >= 0 ? (
                    <mesh
                      ref={(el) => {
                        lightRefs.current[myBeacon] = el
                      }}
                      position={[0, tw.h * 0.97 + tw.mastH + 0.15, 0]}
                    >
                      <sphereGeometry args={[0.09, 8, 8]} />
                      <meshBasicMaterial
                        color="#ff4438"
                        transparent
                        opacity={0.8}
                        depthWrite={false}
                        blending={AdditiveBlending}
                      />
                    </mesh>
                  ) : null}
                </group>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

export function SpaceBackdrop() {
  return (
    <group raycast={() => null}>
      <Nebula />
      <Moons />
      <AsteroidField />
      <FloatingIslands />
      <PassingShips />
      <IslandCore />
      <RimInstallations />
    </group>
  )
}
