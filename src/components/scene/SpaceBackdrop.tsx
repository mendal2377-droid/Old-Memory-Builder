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
 * Deep Space: the diorama as an island torn loose and left adrift in a busy
 * sky. Everything here is unlit and mostly additive so it behaves like distant
 * light rather than geometry the scene's star has to reach.
 */

// -- Shared helpers ----------------------------------------------------------

/** Roughen a geometry so rock reads as rock instead of a clean primitive. */
function jitter(geometry: BufferGeometry, amount: number, seedScale = 1) {
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // Cheap deterministic-ish hash so each vertex moves differently
    const n =
      Math.sin(x * 12.9898 * seedScale + y * 78.233 + z * 37.719) * 43758.5453
    const d = (n - Math.floor(n) - 0.5) * amount
    pos.setXYZ(i, x + d, y + d * 0.7, z + d)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// -- Galactic band -----------------------------------------------------------

let galaxyCache: CanvasTexture | null = null
function getGalaxyTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (galaxyCache) return galaxyCache

  const w = 512
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, w, h)

  // Bright core fading along the band
  const core = ctx.createLinearGradient(0, 0, w, 0)
  core.addColorStop(0, 'rgba(90,70,160,0)')
  core.addColorStop(0.22, 'rgba(130,110,200,0.5)')
  core.addColorStop(0.46, 'rgba(255,238,205,0.92)')
  core.addColorStop(0.56, 'rgba(232,180,220,0.75)')
  core.addColorStop(0.8, 'rgba(120,100,190,0.45)')
  core.addColorStop(1, 'rgba(70,60,140,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, w, h)

  // Vertical falloff so it is a band, not a slab
  const fade = ctx.createLinearGradient(0, 0, 0, h)
  fade.addColorStop(0, 'rgba(0,0,0,1)')
  fade.addColorStop(0.5, 'rgba(0,0,0,0)')
  fade.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'

  // Dark dust lanes threading through it
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 14; i += 1) {
    const y = h * 0.5 + (Math.random() - 0.5) * h * 0.34
    ctx.strokeStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.4})`
    ctx.lineWidth = 2 + Math.random() * 7
    ctx.beginPath()
    ctx.moveTo(-20, y)
    for (let x = -20; x < w + 20; x += 60) {
      ctx.quadraticCurveTo(x + 30, y + (Math.random() - 0.5) * 26, x + 60, y)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // Star speckle inside the band
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * w
    const y = h * 0.5 + (Math.random() - 0.5) * h * (0.2 + Math.random() * 0.6)
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.75})`
    ctx.fillRect(x, y, Math.random() < 0.9 ? 1 : 2, 1)
  }

  galaxyCache = new CanvasTexture(canvas)
  galaxyCache.needsUpdate = true
  return galaxyCache
}

function GalacticBand() {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.0035
  })
  return (
    <group ref={ref} rotation={[0, 0, 0.42]}>
      {[0, Math.PI * 0.66, Math.PI * 1.33].map((a, i) => (
        <mesh
          key={`band-${i}`}
          position={[Math.cos(a) * 120, 34 + i * 5, Math.sin(a) * 120]}
          rotation={[0, -a + Math.PI / 2, 0.16 * (i - 1)]}
          renderOrder={-960}
        >
          <planeGeometry args={[190, 62]} />
          <meshBasicMaterial
            map={getGalaxyTexture()}
            transparent
            opacity={0.72}
            depthWrite={false}
            depthTest={false}
            blending={AdditiveBlending}
            side={DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// -- Nebula ------------------------------------------------------------------

let nebulaCache: CanvasTexture | null = null
function getNebulaTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (nebulaCache) return nebulaCache

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)
  const clouds: Array<[number, number, number, string]> = [
    [104, 116, 96, 'rgba(150, 60, 235, 0.95)'],
    [162, 92, 78, 'rgba(255, 55, 150, 0.8)'],
    [112, 168, 72, 'rgba(40, 190, 245, 0.72)'],
    [186, 176, 62, 'rgba(120, 70, 245, 0.62)'],
    [72, 70, 56, 'rgba(255, 140, 80, 0.45)'],
    [140, 132, 44, 'rgba(255, 220, 240, 0.4)'],
  ]
  for (const [x, y, r, colour] of clouds) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, colour)
    g.addColorStop(0.55, colour.replace(/[\d.]+\)$/, '0.22)'))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Sprinkle stars through the gas
  for (let i = 0; i < 260; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1)
  }
  // Soften the rim so the plane never shows an edge
  const vignette = ctx.createRadialGradient(128, 128, 52, 128, 128, 128)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  nebulaCache = new CanvasTexture(canvas)
  nebulaCache.needsUpdate = true
  return nebulaCache
}

function Nebula() {
  const groupRef = useRef<Group>(null)
  const clouds = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        angle: (i / 8) * Math.PI * 2 + Math.random() * 0.5,
        height: 10 + Math.random() * 52,
        scale: 74 + Math.random() * 66,
        spin: (Math.random() - 0.5) * 0.8,
        opacity: 0.42 + Math.random() * 0.3,
      })),
    [],
  )

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.005
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <mesh
          key={`nebula-${i}`}
          position={[Math.cos(c.angle) * 112, c.height, Math.sin(c.angle) * 112]}
          rotation={[0, -c.angle + Math.PI / 2, c.spin]}
          renderOrder={-940}
        >
          <planeGeometry args={[c.scale, c.scale]} />
          <meshBasicMaterial
            map={getNebulaTexture()}
            transparent
            opacity={c.opacity}
            depthWrite={false}
            depthTest={false}
            blending={AdditiveBlending}
            side={DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// -- Planets -----------------------------------------------------------------

/** Banded gas-giant surface so a sphere reads as a world, not a flat disc. */
function makePlanetTexture(bands: Array<[number, string]>, seed: number) {
  const w = 256
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const g = ctx.createLinearGradient(0, 0, 0, h)
  for (const [stop, colour] of bands) g.addColorStop(stop, colour)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Swirled band detail
  for (let i = 0; i < 26; i += 1) {
    const y = Math.random() * h
    const alpha = 0.05 + Math.random() * 0.14
    ctx.strokeStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${alpha})`
    ctx.lineWidth = 1.5 + Math.random() * 7
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < w; x += 32) {
      ctx.quadraticCurveTo(
        x + 16,
        y + Math.sin(x * 0.05 + seed + i) * 4,
        x + 32,
        y,
      )
    }
    ctx.stroke()
  }

  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

let giantTex: CanvasTexture | null = null
let ringedTex: CanvasTexture | null = null

function Planets() {
  const ringRef = useRef<Mesh>(null)
  const giantRef = useRef<Mesh>(null)

  const textures = useMemo(() => {
    if (typeof document === 'undefined') return { giant: null, ringed: null }
    giantTex =
      giantTex ??
      makePlanetTexture(
        [
          [0, '#2a1a4e'],
          [0.28, '#6a3f96'],
          [0.5, '#a886ce'],
          [0.72, '#6a3f96'],
          [1, '#2a1a4e'],
        ],
        1.7,
      )
    ringedTex =
      ringedTex ??
      makePlanetTexture(
        [
          [0, '#6b4326'],
          [0.3, '#c89058'],
          [0.52, '#e8c99a'],
          [0.74, '#c89058'],
          [1, '#6b4326'],
        ],
        3.1,
      )
    return { giant: giantTex, ringed: ringedTex }
  }, [])

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.015
    if (giantRef.current) giantRef.current.rotation.y += delta * 0.01
  })

  return (
    <group>
      {/* Large banded world low on the horizon */}
      <group position={[-74, 18, -88]}>
        {/* Lit for real, so the terminator falls where the star actually is */}
        <mesh ref={giantRef} renderOrder={-880}>
          <sphereGeometry args={[19, 56, 36]} />
          <meshStandardMaterial
            map={textures.giant}
            color="#ffffff"
            roughness={1}
            metalness={0}
            emissive="#1a0f2e"
            emissiveIntensity={0.5}
            fog={false}
          />
        </mesh>
        {/* Atmospheric rim */}
        <mesh renderOrder={-881}>
          <sphereGeometry args={[20.8, 32, 24]} />
          <meshBasicMaterial
            color="#a874ff"
            transparent
            opacity={0.16}
            side={BackSide}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>

      {/* Ringed companion */}
      <group position={[86, 32, -62]} rotation={[0, 0, 0.34]}>
        <mesh renderOrder={-880}>
          <sphereGeometry args={[8.5, 44, 30]} />
          <meshStandardMaterial
            map={textures.ringed}
            color="#ffffff"
            roughness={1}
            metalness={0}
            emissive="#20140a"
            emissiveIntensity={0.5}
            fog={false}
          />
        </mesh>
        <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]} renderOrder={-878}>
          <ringGeometry args={[11.5, 18, 96]} />
          <meshBasicMaterial
            color="#e6cba4"
            transparent
            opacity={0.5}
            side={DoubleSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>

      {/* Binary companion star, small and sharp */}
      <group position={[52, 46, -96]}>
        <mesh renderOrder={-870}>
          <sphereGeometry args={[1.5, 20, 16]} />
          <meshBasicMaterial color="#ffe9c0" toneMapped={false} fog={false} />
        </mesh>
        <mesh renderOrder={-871}>
          <sphereGeometry args={[5.2, 24, 18]} />
          <meshBasicMaterial
            color="#ffb96a"
            transparent
            opacity={0.22}
            side={BackSide}
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  )
}

// -- Drifting islands --------------------------------------------------------

/** Sister islands: irregular rock keels under uneven caps, each on its own bob. */
function FloatingIslands() {
  const geometries = useMemo(() => {
    const keel = jitter(new ConeGeometry(0.95, 2.1, 9, 5), 0.3, 1)
    const cap = jitter(new ConeGeometry(1.05, 0.42, 10, 2), 0.2, 2.3)
    return { keel, cap }
  }, [])

  const islands = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => {
        const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.7
        const radius = 40 + Math.random() * 52
        return {
          x: Math.cos(angle) * radius,
          y: -14 + Math.random() * 38,
          z: Math.sin(angle) * radius,
          scale: 2.6 + Math.random() * 9,
          tilt: (Math.random() - 0.5) * 0.55,
          spin: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          bob: 0.5 + Math.random() * 1.5,
          hasSpire: Math.random() > 0.55,
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
          {/* Uneven grass cap */}
          <mesh geometry={geometries.cap} position={[0, 0.1, 0]}>
            <meshStandardMaterial
              color="#5c8a4e"
              roughness={1}
              emissive="#0d1a10"
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* Jagged rock keel hanging beneath */}
          <mesh geometry={geometries.keel} position={[0, -0.95, 0]} rotation={[Math.PI, 0, 0]}>
            <meshStandardMaterial
              color="#4a4363"
              roughness={1}
              emissive="#12101f"
              emissiveIntensity={0.6}
            />
          </mesh>
          {/* An occasional spire so silhouettes differ */}
          {isle.hasSpire ? (
            <mesh position={[0.3, 0.5, -0.2]} scale={[0.16, 0.7, 0.16]}>
              <coneGeometry args={[1, 1, 6]} />
              <meshStandardMaterial color="#3d5a38" roughness={1} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  )
}

// -- Asteroid debris ---------------------------------------------------------

function AsteroidField() {
  const meshRef = useRef<InstancedMesh>(null)
  const count = 90
  const geometry = useMemo(
    () => jitter(new DodecahedronGeometry(1, 0), 0.3, 4.1),
    [],
  )
  const rocks = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(count * 16)
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2
      const r = 32 + Math.random() * 70
      dummy.position.set(
        Math.cos(a) * r,
        -18 + Math.random() * 52,
        Math.sin(a) * r,
      )
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      dummy.scale.setScalar(0.3 + Math.pow(Math.random(), 2) * 2.6)
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
        color="#544c6e"
        roughness={1}
        emissive="#14121f"
        emissiveIntensity={0.6}
      />
    </instancedMesh>
  )
}

// -- Traffic -----------------------------------------------------------------

/** Ships crossing the void: small fast fighters and slow heavy freighters. */
function PassingShips() {
  const ships = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => {
        const heavy = i % 4 === 0
        return {
          heavy,
          period: heavy ? 70 + Math.random() * 40 : 22 + Math.random() * 22,
          offset: Math.random() * 60,
          height: 8 + Math.random() * 40,
          depth: -40 - Math.random() * 60,
          span: 190,
          scale: heavy ? 3.4 + Math.random() * 2.6 : 0.8 + Math.random() * 1.3,
          tilt: (Math.random() - 0.5) * 0.35,
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
        ship.height + Math.sin(t * 0.35 + i) * 0.5,
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
          <mesh>
            <boxGeometry args={ship.heavy ? [4.6, 0.8, 1.5] : [2.4, 0.3, 0.6]} />
            <meshBasicMaterial
              color={ship.heavy ? '#8e94a8' : '#ccd2e2'}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          {/* Superstructure / wing */}
          <mesh position={ship.heavy ? [-1.1, 0.55, 0] : [-0.3, 0, 0]}>
            <boxGeometry
              args={ship.heavy ? [1.6, 0.5, 0.9] : [1.0, 0.1, 1.9]}
            />
            <meshBasicMaterial
              color={ship.heavy ? '#6d7388' : '#98a0b4'}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          {/* Engine bloom */}
          <mesh position={[ship.heavy ? -2.6 : -1.4, 0, 0]}>
            <sphereGeometry args={[ship.heavy ? 0.55 : 0.24, 12, 12]} />
            <meshBasicMaterial
              color="#6fe0ff"
              transparent
              opacity={0.95}
              depthWrite={false}
              blending={AdditiveBlending}
              fog={false}
            />
          </mesh>
          {/* Exhaust trail */}
          <mesh
            position={[ship.heavy ? -4.4 : -2.4, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry args={[ship.heavy ? 0.42 : 0.2, ship.heavy ? 3.6 : 2, 10, 1, true]} />
            <meshBasicMaterial
              color="#3aa8ff"
              transparent
              opacity={0.34}
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

/** A halo under the board so the diorama reads as the biggest island here. */
function IslandRim() {
  return (
    <group>
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[22, 34, 64]} />
        <meshBasicMaterial
          color="#6fc8ff"
          transparent
          opacity={0.14}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -2.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[26, 48]} />
        <meshBasicMaterial
          color="#3a86c8"
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

export function SpaceBackdrop() {
  return (
    <group raycast={() => null}>
      <GalacticBand />
      <Nebula />
      <Planets />
      <AsteroidField />
      <FloatingIslands />
      <PassingShips />
      <IslandRim />
    </group>
  )
}
