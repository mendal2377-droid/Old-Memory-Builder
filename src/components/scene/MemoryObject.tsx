import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  Component,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  memo,
} from 'react'
import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  DoubleSide,
  ExtrudeGeometry,
  Shape,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assets } from '../../data/assets'
import { applyWindSway, swayCategories } from '../../data/wind'
import { useSceneStore } from '../../store/sceneStore'
import type { AssetDefinition, SceneObject } from '../../types/scene'
import { useWaterMaterial } from './StylizedWater'

interface MemoryObjectProps {
  object: SceneObject
}

interface ModelErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  modelPath: string
  onError: (path: string) => void
  resetKey: string
}

interface ModelErrorBoundaryState {
  hasError: boolean
}

class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`Failed to load GLTF model: ${this.props.modelPath}`, error)
    this.props.onError(this.props.modelPath)
  }

  componentDidUpdate(previousProps: ModelErrorBoundaryProps) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.hasError
    ) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function FallbackCube({ opacity = 1 }: { opacity?: number }) {
  return (
    <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color="#b9835a"
        opacity={opacity}
        transparent={opacity < 1}
      />
    </mesh>
  )
}

function isSupportedModelPath(path: string | undefined) {
  if (!path) {
    return false
  }

  return (
    path.toLowerCase().endsWith('.glb') ||
    path.toLowerCase().endsWith('.gltf')
  )
}

function GltfModel({
  asset,
  opacity = 1,
  playAnimations = false,
}: {
  asset: AssetDefinition
  opacity?: number
  playAnimations?: boolean
}) {
  const gltf = useGLTF(asset.path ?? '')
  const mixer = useRef<AnimationMixer | null>(null)
  const model = useMemo<Object3D>(() => {
    const clonedScene = clone(gltf.scene)

    const shouldSway = swayCategories.has(asset.category) && opacity >= 1
    let swayHeight = 1
    if (shouldSway) {
      const bounds = new Box3().setFromObject(clonedScene)
      swayHeight = Math.max(bounds.max.y, 0.2)
    }

    clonedScene.traverse((child) => {
      const mesh = child as Mesh

      if (mesh.isMesh) {
        mesh.castShadow = asset.category !== 'Flowers' && asset.category !== 'Paths' && asset.category !== 'Plants'
        mesh.receiveShadow = true

        if (shouldSway) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          materials.forEach((material) => applyWindSway(material, swayHeight))
        }

        if (opacity < 1) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]

          mesh.material = materials.map((material) => {
            const clonedMaterial = material.clone()

            clonedMaterial.transparent = true
            clonedMaterial.opacity = opacity
            clonedMaterial.depthWrite = false

            return clonedMaterial
          }) as Mesh['material']
        }
      }
    })

    return clonedScene
  }, [gltf.scene, opacity, asset.category])

  useEffect(() => {
    if (!playAnimations || gltf.animations.length === 0) {
      mixer.current = null
      return
    }

    const nextMixer = new AnimationMixer(model)
    gltf.animations.forEach((clip) => {
      nextMixer.clipAction(clip).play()
    })
    mixer.current = nextMixer

    return () => {
      nextMixer.stopAllAction()
      mixer.current = null
    }
  }, [gltf.animations, model, playAnimations])

  useFrame((_, delta) => {
    mixer.current?.update(delta)
  })

  return <primitive object={model} position={[0, asset.yOffset, 0]} />
}

// Triangular prism roof geometry — built once at module load
const roofShape = new Shape()
roofShape.moveTo(-1, 0)
roofShape.lineTo(1, 0)
roofShape.lineTo(0, 0.85)
roofShape.closePath()
const roofGeometry = new ExtrudeGeometry(roofShape, {
  depth: 1,
  bevelEnabled: false,
})

const cabinPalettes: Record<string, {
  wall: string
  trim: string
  roof: string
  door: string
}> = {
  cabin_01: { wall: '#d4b896', trim: '#7a5a3e', roof: '#9d4a3a', door: '#5a3d28' },
  cabin_02: { wall: '#c9a87c', trim: '#5e4630', roof: '#a35640', door: '#4a3220' },
  cabin_03: { wall: '#e0c8a0', trim: '#8a6840', roof: '#8a4030', door: '#5a3d28' },
  cabin_04: { wall: '#caa884', trim: '#704a30', roof: '#b6543c', door: '#3e2820' },
  cabin_05: { wall: '#d8c0a0', trim: '#6e4e34', roof: '#8e3e30', door: '#4a3220' },
}

function WoodCabin({ asset }: { asset: AssetDefinition }) {
  const palette = cabinPalettes[asset.id] ?? cabinPalettes.cabin_01
  const isTwoStory = asset.id === 'cabin_05'
  // Footprint
  const w = isTwoStory ? 1.6 : 1.7
  const d = isTwoStory ? 1.4 : 1.4
  const h = isTwoStory ? 2.3 : 1.25
  const roofRiseScale = isTwoStory ? 0.85 : 0.7

  return (
    <group>
      {/* Wall body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={palette.wall} roughness={0.85} />
      </mesh>
      {/* Mid-floor band trim — two-story only */}
      {isTwoStory ? (
        <mesh position={[0, h * 0.5, 0]} receiveShadow>
          <boxGeometry args={[w + 0.04, 0.08, d + 0.04]} />
          <meshStandardMaterial color={palette.trim} roughness={0.9} />
        </mesh>
      ) : null}
      {/* Door */}
      <mesh position={[0, 0.36, d / 2 + 0.001]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.72, 0.04]} />
        <meshStandardMaterial color={palette.door} roughness={0.9} />
      </mesh>
      {/* Front window left (first floor) */}
      <mesh position={[-0.5, 0.85, d / 2 + 0.001]} receiveShadow>
        <boxGeometry args={[0.26, 0.28, 0.03]} />
        <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Front window right (first floor) */}
      <mesh position={[0.5, 0.85, d / 2 + 0.001]} receiveShadow>
        <boxGeometry args={[0.26, 0.28, 0.03]} />
        <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Second-floor windows */}
      {isTwoStory ? (
        <>
          <mesh position={[-0.45, h * 0.78, d / 2 + 0.001]} receiveShadow>
            <boxGeometry args={[0.3, 0.36, 0.03]} />
            <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
          </mesh>
          <mesh position={[0.45, h * 0.78, d / 2 + 0.001]} receiveShadow>
            <boxGeometry args={[0.3, 0.36, 0.03]} />
            <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
          </mesh>
        </>
      ) : null}
      {/* Side window */}
      <mesh position={[w / 2 + 0.001, 0.78, 0]} receiveShadow>
        <boxGeometry args={[0.03, 0.28, 0.32]} />
        <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Foundation trim */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[w + 0.05, 0.12, d + 0.05]} />
        <meshStandardMaterial color={palette.trim} roughness={0.9} />
      </mesh>
      {/* Triangular prism roof — extruded along Z, fitted to house depth */}
      <mesh
        geometry={roofGeometry}
        position={[0, h, -d / 2]}
        scale={[w / 2 * 1.08, roofRiseScale, d]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.roof} roughness={0.88} />
      </mesh>
      {/* Chimney */}
      <mesh position={[w / 2 - 0.45, h + (isTwoStory ? 0.75 : 0.55), -d / 4]} castShadow receiveShadow>
        <boxGeometry args={[0.18, isTwoStory ? 0.65 : 0.45, 0.18]} />
        <meshStandardMaterial color={palette.trim} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Barn() {
  // Wider, lower profile, classic red barn
  const w = 2.6
  const d = 1.9
  const h = 1.3
  return (
    <group>
      {/* Body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#a83a2e" roughness={0.92} />
      </mesh>
      {/* White trim band */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[w + 0.04, 0.18, d + 0.04]} />
        <meshStandardMaterial color="#ede5d2" roughness={0.85} />
      </mesh>
      {/* Big double door front */}
      <mesh position={[0, 0.52, d / 2 + 0.001]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.95, 0.05]} />
        <meshStandardMaterial color="#3a2418" roughness={0.92} />
      </mesh>
      {/* Door cross trim */}
      <mesh position={[0, 0.52, d / 2 + 0.025]} receiveShadow>
        <boxGeometry args={[0.85, 0.05, 0.02]} />
        <meshStandardMaterial color="#ede5d2" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.52, d / 2 + 0.025]} rotation={[0, 0, Math.PI / 2]} receiveShadow>
        <boxGeometry args={[0.95, 0.05, 0.02]} />
        <meshStandardMaterial color="#ede5d2" roughness={0.85} />
      </mesh>
      {/* Loft window — circle approx via flat box */}
      <mesh position={[0, h + 0.45, d / 2 + 0.001]} receiveShadow>
        <boxGeometry args={[0.28, 0.28, 0.03]} />
        <meshStandardMaterial color="#3a2418" roughness={0.6} />
      </mesh>
      {/* Side windows */}
      <mesh position={[-w / 2 - 0.001, 0.7, 0.4]} receiveShadow>
        <boxGeometry args={[0.03, 0.3, 0.32]} />
        <meshStandardMaterial color="#ede5d2" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2 - 0.001, 0.7, -0.4]} receiveShadow>
        <boxGeometry args={[0.03, 0.3, 0.32]} />
        <meshStandardMaterial color="#ede5d2" roughness={0.7} />
      </mesh>
      {/* Gable roof */}
      <mesh
        geometry={roofGeometry}
        position={[0, h, -d / 2]}
        scale={[w / 2 * 1.08, 0.85, d]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#6a382e" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Watermill() {
  const wheelRef = useRef<Group>(null)
  useFrame((_, delta) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.x += delta * 0.6
    }
  })
  const w = 1.7
  const d = 1.5
  const h = 1.7
  const wheelRadius = 0.95
  return (
    <group>
      {/* Mill body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#bfa478" roughness={0.88} />
      </mesh>
      {/* Stone foundation */}
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <boxGeometry args={[w + 0.1, 0.36, d + 0.1]} />
        <meshStandardMaterial color="#7a7268" roughness={0.95} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.5, d / 2 + 0.001]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.8, 0.04]} />
        <meshStandardMaterial color="#4a3020" roughness={0.92} />
      </mesh>
      {/* Window */}
      <mesh position={[0, 1.2, d / 2 + 0.001]} receiveShadow>
        <boxGeometry args={[0.32, 0.32, 0.03]} />
        <meshStandardMaterial color="#4a6a7a" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Roof */}
      <mesh
        geometry={roofGeometry}
        position={[0, h, -d / 2]}
        scale={[w / 2 * 1.08, 0.7, d]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#5e3828" roughness={0.9} />
      </mesh>
      {/* Water wheel — mounted on the +X side */}
      <group ref={wheelRef} position={[w / 2 + 0.35, wheelRadius + 0.08, 0]} rotation={[0, 0, 0]}>
        {/* Hub */}
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.28, 12]} />
          <meshStandardMaterial color="#3a2818" roughness={0.85} />
        </mesh>
        {/* Outer rim — two rings */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.06, 0, 0]} castShadow>
          <torusGeometry args={[wheelRadius, 0.045, 8, 28]} />
          <meshStandardMaterial color="#5a3e28" roughness={0.88} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.06, 0, 0]} castShadow>
          <torusGeometry args={[wheelRadius, 0.045, 8, 28]} />
          <meshStandardMaterial color="#5a3e28" roughness={0.88} />
        </mesh>
        {/* Paddles around the rim — tangent boxes (width along axis, length tangential, thin radial) */}
        {Array.from({ length: 10 }).map((_, i) => {
          const angle = (i / 10) * Math.PI * 2
          const py = Math.sin(angle) * wheelRadius
          const pz = Math.cos(angle) * wheelRadius
          return (
            <mesh
              key={`paddle-${i}`}
              position={[0, py, pz]}
              rotation={[angle, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.3, 0.32, 0.05]} />
              <meshStandardMaterial color="#4a3020" roughness={0.92} />
            </mesh>
          )
        })}
        {/* Spokes — must lie in the YZ plane (wheel disc), so rotate around the wheel's X axis */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh key={`spoke-${i}`} rotation={[angle, 0, 0]} castShadow>
              <boxGeometry args={[0.04, wheelRadius * 1.85, 0.04]} />
              <meshStandardMaterial color="#5a3e28" roughness={0.9} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

function Lighthouse() {
  const beamRef = useRef<Group>(null)
  const lampRef = useRef<Mesh>(null)
  const gameMode = useSceneStore((state) => state.gameMode)
  const isBeamOn = gameMode === 'won'

  useFrame(({ clock }, delta) => {
    if (lampRef.current) {
      const mat = lampRef.current.material as MeshStandardMaterial & { emissiveIntensity?: number }
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = isBeamOn
          ? 2.6 + Math.sin(clock.elapsedTime * 2.2) * 0.3
          : 1.5 + Math.sin(clock.elapsedTime * 1.4) * 0.22
      }
    }
    if (isBeamOn && beamRef.current) {
      beamRef.current.rotation.y += delta * 0.7
    }
  })

  const baseR = 0.6
  const topR = 0.46
  const towerH = 3.4
  const galleryR = 0.85
  const galleryH = 0.1
  const lampR = 0.52
  const lampH = 0.7
  const roofH = 0.65

  // Tower body Y-center is towerH/2 + foundation height
  const foundationH = 0.22
  const towerBottomY = foundationH
  const galleryY = towerBottomY + towerH
  const lampBottomY = galleryY + galleryH
  const roofBottomY = lampBottomY + lampH

  return (
    <group>
      {/* Rock shelf: the lighthouse should sit on ground that rose to meet it */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.55, 1.95, 0.42, 9]} />
        <meshStandardMaterial color="#7e7d78" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.65, 0.02, -0.5]} rotation={[0.2, 0.7, 0.1]} receiveShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#74736f" roughness={1} flatShading />
      </mesh>
      {/* Warm lamp glow, on at every hour rather than only when the game is won */}
      <pointLight
        position={[0, foundationH + towerH + 0.55, 0]}
        color="#ffcf87"
        intensity={2.6}
        distance={9}
        decay={2}
      />
      {/* Stone foundation */}
      <mesh position={[0, foundationH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[baseR + 0.18, baseR + 0.22, foundationH, 16]} />
        <meshStandardMaterial color="#7a7268" roughness={0.95} />
      </mesh>
      {/* Tower body — slight taper */}
      <mesh position={[0, towerBottomY + towerH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[topR, baseR, towerH, 20]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.85} />
      </mesh>
      {/* Red stripe 1 (lower) */}
      <mesh position={[0, towerBottomY + towerH * 0.32, 0]} castShadow>
        <cylinderGeometry args={[
          baseR + (topR - baseR) * 0.32 + 0.005,
          baseR + (topR - baseR) * 0.28 + 0.005,
          towerH * 0.16,
          20,
        ]} />
        <meshStandardMaterial color="#b13a2a" roughness={0.86} />
      </mesh>
      {/* Red stripe 2 (upper) */}
      <mesh position={[0, towerBottomY + towerH * 0.72, 0]} castShadow>
        <cylinderGeometry args={[
          baseR + (topR - baseR) * 0.72 + 0.005,
          baseR + (topR - baseR) * 0.68 + 0.005,
          towerH * 0.16,
          20,
        ]} />
        <meshStandardMaterial color="#b13a2a" roughness={0.86} />
      </mesh>
      {/* Door at base */}
      <mesh position={[0, towerBottomY + 0.42, baseR + 0.005]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.78, 0.04]} />
        <meshStandardMaterial color="#3a2418" roughness={0.92} />
      </mesh>
      {/* Two small port-hole windows on the tower */}
      {[0.55, 1.6].map((y, i) => (
        <mesh key={`porthole-${i}`} position={[0, towerBottomY + 1.2 + y, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <torusGeometry args={[0.09, 0.025, 8, 16]} />
          <meshStandardMaterial color="#3a2418" roughness={0.7} />
        </mesh>
      ))}
      {/* Gallery walkway ring around the lamp room */}
      <mesh position={[0, galleryY + galleryH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[galleryR, galleryR, galleryH, 24]} />
        <meshStandardMaterial color="#5a3e28" roughness={0.9} />
      </mesh>
      {/* Gallery railing — torus on top */}
      <mesh position={[0, galleryY + galleryH + 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[galleryR - 0.04, 0.025, 6, 24]} />
        <meshStandardMaterial color="#3a2418" roughness={0.85} />
      </mesh>
      {/* Gallery railing posts */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2
        const x = Math.cos(a) * (galleryR - 0.04)
        const z = Math.sin(a) * (galleryR - 0.04)
        return (
          <mesh key={`rpost-${i}`} position={[x, galleryY + galleryH + 0.1, z]} castShadow>
            <boxGeometry args={[0.04, 0.2, 0.04]} />
            <meshStandardMaterial color="#3a2418" roughness={0.85} />
          </mesh>
        )
      })}
      {/* Lamp room walls — clear glass */}
      <mesh position={[0, lampBottomY + lampH / 2, 0]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[lampR, lampR, lampH, 16, 1, true]} />
        <meshStandardMaterial color="#b8d8ec" transparent opacity={0.25} roughness={0.15} metalness={0.3} />
      </mesh>
      {/* Lamp room vertical frame posts */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        const x = Math.cos(a) * lampR
        const z = Math.sin(a) * lampR
        return (
          <mesh key={`frame-${i}`} position={[x, lampBottomY + lampH / 2, z]} castShadow>
            <boxGeometry args={[0.05, lampH, 0.05]} />
            <meshStandardMaterial color="#3a2418" roughness={0.85} />
          </mesh>
        )
      })}
      {/* The bright lamp inside */}
      <mesh ref={lampRef} position={[0, lampBottomY + lampH / 2, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#fff2b0"
          emissive="#ffb84a"
          emissiveIntensity={0.6}
          roughness={0.2}
        />
      </mesh>
      {/* Rotating beam — lights up when the storm game is won */}
      <group ref={beamRef} position={[0, lampBottomY + lampH / 2, 0]}>
        {isBeamOn ? (
          <>
            {/* Main beam pointing +X: apex at the lamp, widening outward */}
            <mesh position={[9, 0, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={90}>
              <coneGeometry args={[2.0, 18, 16, 1, true]} />
              <meshBasicMaterial
                color="#ffe9a8"
                transparent
                opacity={0.2}
                depthWrite={false}
                side={DoubleSide}
                blending={AdditiveBlending}
              />
            </mesh>
            {/* Counter-beam pointing -X */}
            <mesh position={[-9, 0, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={90}>
              <coneGeometry args={[2.0, 18, 16, 1, true]} />
              <meshBasicMaterial
                color="#ffe9a8"
                transparent
                opacity={0.14}
                depthWrite={false}
                side={DoubleSide}
                blending={AdditiveBlending}
              />
            </mesh>
            {/* Warm glow cast onto the surroundings */}
            <pointLight color="#ffd88a" intensity={2.4} distance={34} decay={1.6} />
          </>
        ) : null}
      </group>
      {/* Conical roof */}
      <mesh position={[0, roofBottomY + roofH / 2, 0]} castShadow receiveShadow>
        <coneGeometry args={[lampR + 0.06, roofH, 16]} />
        <meshStandardMaterial color="#9a3326" roughness={0.85} />
      </mesh>
      {/* Spire/finial on top */}
      <mesh position={[0, roofBottomY + roofH + 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.24, 8]} />
        <meshStandardMaterial color="#3a2418" roughness={0.7} />
      </mesh>
      <mesh position={[0, roofBottomY + roofH + 0.3, 0]} castShadow>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#3a2418" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Woodpile() {
  // A short stack of logs plus a couple of loose ones
  const logColor = '#8a5a34'
  const endColor = '#c9a06a'
  return (
    <group>
      {/* Bottom row of 3 logs */}
      {[-0.32, 0, 0.32].map((z, i) => (
        <mesh key={`b-${i}`} position={[0, 0.16, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 1.1, 12]} />
          <meshStandardMaterial color={logColor} roughness={0.9} />
        </mesh>
      ))}
      {/* Middle row of 2 logs */}
      {[-0.16, 0.16].map((z, i) => (
        <mesh key={`m-${i}`} position={[0, 0.44, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 1.1, 12]} />
          <meshStandardMaterial color={logColor} roughness={0.9} />
        </mesh>
      ))}
      {/* Top log */}
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.16, 1.1, 12]} />
        <meshStandardMaterial color={logColor} roughness={0.9} />
      </mesh>
      {/* Light end-grain caps on the front faces */}
      {[0.16, 0.44, 0.44, 0.7].map((y, i) => {
        const z = [0, -0.16, 0.16, 0][i]
        return (
          <mesh key={`cap-${i}`} position={[0.552, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.155, 0.155, 0.02, 12]} />
            <meshStandardMaterial color={endColor} roughness={0.85} />
          </mesh>
        )
      })}
      {/* A loose log on the ground */}
      <mesh position={[0.1, 0.15, 0.75]} rotation={[0, 0.4, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.95, 12]} />
        <meshStandardMaterial color={logColor} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bridge() {
  // Bridge spans along the X axis by default (placed perpendicular across a river)
  const length = 4.6 // along X
  const width = 1.4 // along Z (walkable width)
  const deckThickness = 0.12
  const railHeight = 0.5
  return (
    <group>
      {/* Plank deck */}
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, deckThickness, width]} />
        <meshStandardMaterial color="#9a6a44" roughness={0.92} />
      </mesh>
      {/* Plank seams — 8 planks across length */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = -length / 2 + ((i + 1) * length) / 8
        return (
          <mesh key={`seam-${i}`} position={[x, 0.49, 0]} receiveShadow>
            <boxGeometry args={[0.02, 0.005, width]} />
            <meshStandardMaterial color="#5a3a20" roughness={0.95} />
          </mesh>
        )
      })}
      {/* Railings (two sides) */}
      {[-width / 2 - 0.04, width / 2 + 0.04].map((z, i) => (
        <group key={`rail-${i}`}>
          {/* Top rail */}
          <mesh position={[0, 0.42 + railHeight, z]} castShadow receiveShadow>
            <boxGeometry args={[length, 0.08, 0.08]} />
            <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
          </mesh>
          {/* Posts */}
          {Array.from({ length: 5 }).map((_, j) => {
            const x = -length / 2 + (j * length) / 4
            return (
              <mesh key={`post-${i}-${j}`} position={[x, 0.42 + railHeight / 2, z]} castShadow receiveShadow>
                <boxGeometry args={[0.1, railHeight, 0.1]} />
                <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
              </mesh>
            )
          })}
        </group>
      ))}
      {/* Support pillars going into the water at each end */}
      <mesh position={[-length / 2 + 0.3, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.84, width + 0.2]} />
        <meshStandardMaterial color="#6a4228" roughness={0.92} />
      </mesh>
      <mesh position={[length / 2 - 0.3, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.84, width + 0.2]} />
        <meshStandardMaterial color="#6a4228" roughness={0.92} />
      </mesh>
    </group>
  )
}

function WaterAssetMesh({ asset }: { asset: AssetDefinition }) {
  const isStraight = asset.id.includes('straight')
  const isCurve = asset.id.includes('curve')
  const material = useWaterMaterial(0.82)

  if (isCurve) {
    return (
      <group position={[0, asset.yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh material={material}>
          <torusGeometry args={[0.62, 0.24, 12, 36, Math.PI * 1.35]} />
        </mesh>
      </group>
    )
  }

  return (
    <mesh
      position={[0, asset.yOffset, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      castShadow={false}
      receiveShadow
    >
      {isStraight ? (
        <planeGeometry args={[1, 1]} />
      ) : (
        <circleGeometry args={[0.75, 36]} />
      )}
    </mesh>
  )
}

export function AssetModel({
  asset,
  opacity = 1,
  playAnimations = false,
}: {
  asset: AssetDefinition
  opacity?: number
  playAnimations?: boolean
}) {
  const reportModelLoadFailure = useSceneStore(
    (state) => state.reportModelLoadFailure,
  )
  const isSupported = isSupportedModelPath(asset.path)

  useEffect(() => {
    if (
      asset.kind !== 'water' &&
      asset.kind !== 'cabin' &&
      asset.kind !== 'barn' &&
      asset.kind !== 'mill' &&
      asset.kind !== 'bridge' &&
      asset.kind !== 'lighthouse' &&
      asset.kind !== 'woodpile' &&
      !isSupported
    ) {
      console.error(
        `Unsupported model path: ${asset.path ?? 'missing path'}. Browser loading supports .glb and .gltf only; .blend files must be exported to .glb before use.`,
      )
      reportModelLoadFailure(asset.path ?? 'missing path')
    }
  }, [asset.kind, asset.path, isSupported, reportModelLoadFailure])

  if (asset.kind === 'water') {
    return <WaterAssetMesh asset={asset} />
  }

  if (asset.kind === 'cabin') {
    return <WoodCabin asset={asset} />
  }

  if (asset.kind === 'barn') {
    return <Barn />
  }

  if (asset.kind === 'mill') {
    return <Watermill />
  }

  if (asset.kind === 'bridge') {
    return <Bridge />
  }

  if (asset.kind === 'lighthouse') {
    return <Lighthouse />
  }

  if (asset.kind === 'woodpile') {
    return <Woodpile />
  }

  if (!isSupported) {
    return <FallbackCube opacity={opacity} />
  }

  return (
    <ModelErrorBoundary
      fallback={<FallbackCube opacity={opacity} />}
      modelPath={asset.path ?? 'missing path'}
      onError={reportModelLoadFailure}
      resetKey={asset.path ?? asset.id}
    >
      <Suspense fallback={<FallbackCube opacity={opacity} />}>
        <GltfModel
          asset={asset}
          opacity={opacity}
          playAnimations={playAnimations}
        />
      </Suspense>
    </ModelErrorBoundary>
  )
}

const boardLimit = 23
const wanderRadius = 4
const wanderSpeed = 0.45

function clampToBoard(value: number) {
  return Math.min(boardLimit, Math.max(-boardLimit, value))
}

function MemoryObjectComponent({ object }: MemoryObjectProps) {
  const asset = assets.find((item) => item.id === object.assetId)
  const groupRef = useRef<Group>(null)
  const modelGroupRef = useRef<Group>(null)
  const selectObject = useSceneStore((state) => state.selectObject)
  const atmospherePreset = useSceneStore((state) => state.atmospherePreset)
  const areAnimalsWalking = useSceneStore((state) => state.areAnimalsWalking)
  const updateObjectMotion = useSceneStore((state) => state.updateObjectMotion)
  const isSelected = useSceneStore(
    (state) => state.selectedObjectId === object.id,
  )
  const canSway =
    asset?.category === 'Trees' ||
    asset?.category === 'Plants' ||
    asset?.category === 'Flowers'
  const isAnimal = asset?.category === 'Animals'
  const originRef = useRef(new Vector3(...object.position))
  const targetRef = useRef(new Vector3(...object.position))
  const pauseUntilRef = useRef(0)
  const commitElapsedRef = useRef(0)
  const wasWalkingRef = useRef(false)

  useEffect(() => {
    originRef.current.set(object.position[0], 0, object.position[2])
    targetRef.current.set(object.position[0], 0, object.position[2])

    if (groupRef.current) {
      groupRef.current.position.set(object.position[0], 0, object.position[2])
      groupRef.current.rotation.set(
        object.rotation[0],
        object.rotation[1],
        object.rotation[2],
      )
    }
  }, [object.position, object.rotation])

  const chooseWanderTarget = (elapsedTime: number) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 1.2 + Math.random() * wanderRadius
    const origin = originRef.current

    targetRef.current.set(
      clampToBoard(origin.x + Math.cos(angle) * distance),
      0,
      clampToBoard(origin.z + Math.sin(angle) * distance),
    )
    pauseUntilRef.current = elapsedTime + Math.random() * 1.5 + 0.7
  }

  useFrame(({ clock }) => {
    if (!canSway || !modelGroupRef.current) {
      return
    }

    const windBoost = atmospherePreset === 'Rainy Day' ? 1.7 : 1
    const phase = object.position[0] * 0.31 + object.position[2] * 0.19
    const sway = Math.sin(clock.elapsedTime * 0.8 + phase) * 0.012 * windBoost

    modelGroupRef.current.rotation.z = sway
    modelGroupRef.current.position.x = sway * 0.35
  })

  useFrame(({ clock }, delta) => {
    if (!isAnimal || !groupRef.current) {
      return
    }

    if (!areAnimalsWalking) {
      wasWalkingRef.current = false
      return
    }

    const group = groupRef.current
    const elapsedTime = clock.elapsedTime

    if (!wasWalkingRef.current) {
      originRef.current.copy(group.position)
      targetRef.current.copy(group.position)
      pauseUntilRef.current = elapsedTime + Math.random() * 1.2 + 0.8
      wasWalkingRef.current = true
    }

    if (elapsedTime < pauseUntilRef.current) {
      if (modelGroupRef.current) {
        modelGroupRef.current.position.y =
          Math.sin(elapsedTime * 4.2 + object.position[0]) * 0.018
      }
      return
    }

    const direction = targetRef.current.clone().sub(group.position)
    direction.y = 0

    if (direction.length() < 0.12) {
      chooseWanderTarget(elapsedTime)
      return
    }

    const step = Math.min(direction.length(), wanderSpeed * delta)
    direction.normalize()
    group.position.x = clampToBoard(group.position.x + direction.x * step)
    group.position.y = 0
    group.position.z = clampToBoard(group.position.z + direction.z * step)
    group.rotation.y = Math.atan2(direction.x, direction.z)

    if (modelGroupRef.current) {
      modelGroupRef.current.position.y =
        Math.sin(elapsedTime * 6 + object.position[0]) * 0.035
    }

    commitElapsedRef.current += delta

    if (commitElapsedRef.current > 0.45) {
      commitElapsedRef.current = 0
      updateObjectMotion(
        object.id,
        [group.position.x, 0, group.position.z],
        [object.rotation[0], group.rotation.y, object.rotation[2]],
      )
    }
  })

  if (!asset) {
    return null
  }

  return (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={(event) => {
        event.stopPropagation()
        selectObject(object.id)
      }}
    >
      {isSelected ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.04, 8, 36]} />
          <meshBasicMaterial color="#f2c94c" />
        </mesh>
      ) : null}
      <group ref={modelGroupRef}>
        <AssetModel
          asset={asset}
          playAnimations={isAnimal && areAnimalsWalking}
        />
      </group>
    </group>
  )
}

export const MemoryObject = memo(
  MemoryObjectComponent,
  (previous, next) => previous.object === next.object,
)
