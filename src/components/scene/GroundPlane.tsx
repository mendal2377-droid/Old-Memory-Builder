import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  CanvasTexture,
  ExtrudeGeometry,
  RepeatWrapping,
  Shape,
  type GridHelper,
} from 'three'
import type { TerrainMode } from '../../types/scene'
import { useSceneStore } from '../../store/sceneStore'
import { CityBackdrop } from './CityBackdrop'
import { SpaceBackdrop } from './SpaceBackdrop'
import { GardenRoute } from './GardenRoute'
import { GrassField } from './GrassField'
import { PondWater, RiverWater, type WaterBlob } from './StylizedWater'

interface GroundPlaneProps {
  terrainMode: TerrainMode
  cameraMode: 'build' | 'walk'
  isGridVisible: boolean
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void
  onGroundPointerMove?: (event: ThreeEvent<PointerEvent>) => void
}

interface OrganicPatchProps {
  color: string
  opacity?: number
  pieces: Array<{
    position: [number, number, number]
    scale: [number, number, number]
    rotation?: number
  }>
}

const boardSize = 48

function createRidgeGeometry(points: [number, number][], depth: number) {
  const shape = new Shape()
  shape.moveTo(points[0][0], 0)
  shape.lineTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    shape.quadraticCurveTo(curr[0], curr[1], (curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2)
  }
  const last = points[points.length - 1]
  shape.quadraticCurveTo(last[0], last[1], last[0], 0)
  shape.closePath()
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
}

const farRidgeGeo = createRidgeGeometry([
  [-34, 0], [-24, 9.8], [-14, 6.4], [-4, 16.2], [6, 12.6], [17, 8.0], [27, 4.8], [34, 0],
], 10)

const midRidgeGeo = createRidgeGeometry([
  [-28, 0], [-19, 8.4], [-8, 4.8], [3, 10.6], [14, 6.2], [26, 0],
], 8)

const frontRidgeGeo = createRidgeGeometry([
  [-22, 0], [-14, 3.9], [-6, 2.6], [3, 5.5], [12, 3.6], [19, 1.6], [22, 0],
], 6)

function drawSpeckles(
  context: CanvasRenderingContext2D,
  color: string,
  count: number,
  alpha: number,
) {
  context.fillStyle = color
  context.globalAlpha = alpha

  for (let index = 0; index < count; index += 1) {
    const size = Math.random() * 2.4 + 0.6
    context.beginPath()
    context.arc(
      Math.random() * context.canvas.width,
      Math.random() * context.canvas.height,
      size,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  context.globalAlpha = 1
}

function createCanvasTexture(
  base: string,
  accents: Array<[string, number, number]>,
) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.fillStyle = base
  context.fillRect(0, 0, canvas.width, canvas.height)
  accents.forEach(([color, count, alpha]) => {
    drawSpeckles(context, color, count, alpha)
  })

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(12, 12)
  texture.needsUpdate = true

  return texture
}

function createTerrainTexture(terrainMode: TerrainMode) {
  if (terrainMode === 'Village Road') {
    return createCanvasTexture('#9baa6d', [
      ['#6f8952', 420, 0.23],
      ['#b28a5d', 260, 0.18],
      ['#e1c791', 120, 0.12],
    ])
  }

  if (terrainMode === 'Field Path') {
    return createCanvasTexture('#a7bd73', [
      ['#6f955b', 520, 0.25],
      ['#c7b96d', 240, 0.16],
      ['#f0d990', 120, 0.1],
    ])
  }

  if (terrainMode === 'Riverbank') {
    return createCanvasTexture('#8fba73', [
      ['#5f8b4f', 560, 0.22],
      ['#b7a472', 180, 0.18],
      ['#d8c693', 110, 0.13],
    ])
  }

  if (terrainMode === 'Courtyard') {
    return createCanvasTexture('#cfc5b4', [
      ['#a99f8f', 360, 0.2],
      ['#e0d5c4', 180, 0.14],
      ['#8ea46f', 120, 0.1],
    ])
  }

  return createCanvasTexture('#91b877', [
    ['#5e8c4c', 560, 0.24],
    ['#b7d08a', 260, 0.18],
    ['#779b5d', 180, 0.14],
  ])
}

function createSnowTexture() {
  return createCanvasTexture('#eef5f5', [
    ['#ffffff', 520, 0.34],
    ['#d8e8ee', 220, 0.16],
    ['#f7fbfb', 180, 0.24],
  ])
}

const grassClumps: Array<[number, number, number]> = [
  [-20, 0.04, -15],
  [-18, 0.04, 10],
  [-9, 0.04, 18],
  [-3, 0.04, -21],
  [8, 0.04, -16],
  [13, 0.04, 19],
  [18, 0.04, 7],
  [21, 0.04, -8],
  [4, 0.04, 11],
  [-15, 0.04, -2],
  [-22, 0.04, 5],
  [-11, 0.04, -14],
  [0, 0.04, 22],
  [6, 0.04, -22],
  [22, 0.04, 2],
  [-17, 0.04, 20],
  [10, 0.04, 8],
  [-6, 0.04, -18],
  [16, 0.04, -20],
  [-20, 0.04, -22],
  [19, 0.04, 15],
  [-5, 0.04, 15],
  [14, 0.04, -5],
  [-8, 0.04, 6],
]

const flowers: Array<[number, number, number]> = [
  [-19, 0.08, 14],
  [-14, 0.08, 17],
  [-6, 0.08, 20],
  [10, 0.08, -18],
  [18, 0.08, 13],
  [21, 0.08, -13],
  [-22, 0.08, -10],
  [5, 0.08, 21],
  [-12, 0.08, 8],
  [22, 0.08, -18],
  [-7, 0.08, -22],
  [15, 0.08, 22],
]

const rocks: Array<[number, number, number]> = [
  [-22, 0.08, -4],
  [-13, 0.08, -20],
  [-1, 0.08, 21],
  [8, 0.08, 18],
  [16, 0.08, -15],
  [22, 0.08, -3],
]

function OrganicPatch({ color, opacity = 1, pieces }: OrganicPatchProps) {
  return (
    <group>
      {pieces.map((piece, index) => (
        <mesh
          key={`${color}-${index}`}
          position={piece.position}
          rotation={[-Math.PI / 2, 0, piece.rotation ?? 0]}
          scale={piece.scale}
          raycast={() => null}
        >
          <circleGeometry args={[1, 28]} />
          <meshStandardMaterial color={color} opacity={opacity} transparent />
        </mesh>
      ))}
    </group>
  )
}

function GrassTextureLayer() {
  return (
    <group>
      <OrganicPatch
        color="#9ec17b"
        opacity={0.32}
        pieces={[
          { position: [-18, 0.009, -18], scale: [7.5, 4.8, 1], rotation: 0.25 },
          { position: [-9, 0.009, 12], scale: [8.2, 5.4, 1], rotation: -0.18 },
          { position: [4, 0.009, -14], scale: [6.8, 4.6, 1], rotation: 0.4 },
          { position: [15, 0.009, 16], scale: [7.4, 5.2, 1], rotation: -0.28 },
          { position: [19, 0.009, -7], scale: [5.8, 4.3, 1], rotation: 0.18 },
        ]}
      />
      <OrganicPatch
        color="#779b5d"
        opacity={0.22}
        pieces={[
          { position: [-20, 0.011, 4], scale: [4.5, 2.8, 1], rotation: -0.45 },
          { position: [-1, 0.011, 18], scale: [4.2, 3.1, 1], rotation: 0.3 },
          { position: [10, 0.011, 3], scale: [5.2, 3.6, 1], rotation: -0.15 },
          { position: [2, 0.011, -22], scale: [4.4, 2.7, 1], rotation: 0.2 },
        ]}
      />
    </group>
  )
}

function CurvedPath({
  color,
  points,
}: {
  color: string
  points: Array<[number, number, number, number, number]>
}) {
  return (
    <group>
      {points.map(([x, z, width, length, rotation], index) => (
        <mesh
          key={`${color}-${index}`}
          position={[x, 0.018 + index * 0.0005, z]}
          rotation={[-Math.PI / 2, 0, rotation]}
          scale={[width, length, 1]}
          raycast={() => null}
        >
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

function TerrainScatter() {
  return (
    <group>
      {grassClumps.map((position, index) => (
        <group key={`grass-${index}`} position={position}>
          <mesh rotation={[0.25, 0, -0.25]} raycast={() => null}>
            <coneGeometry args={[0.09, 0.44, 5]} />
            <meshStandardMaterial color="#6f9b62" />
          </mesh>
          <mesh position={[0.12, 0, 0.05]} rotation={[0.2, 0, 0.35]} raycast={() => null}>
            <coneGeometry args={[0.08, 0.38, 5]} />
            <meshStandardMaterial color="#7faa6f" />
          </mesh>
          <mesh position={[-0.09, 0, 0.07]} rotation={[0.15, 0, -0.22]} raycast={() => null}>
            <coneGeometry args={[0.07, 0.34, 5]} />
            <meshStandardMaterial color="#85a87a" />
          </mesh>
        </group>
      ))}
      {flowers.map((position, index) => (
        <group key={`flower-${index}`} position={position}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.082, 8, 8]} />
            <meshStandardMaterial
              color={
                index % 3 === 0 ? '#e8b1a4' :
                index % 3 === 1 ? '#f0d48a' : '#d4aae8'
              }
            />
          </mesh>
        </group>
      ))}
      {rocks.map((position, index) => (
        <mesh
          key={`rock-${index}`}
          position={position}
          scale={[0.18, 0.12, 0.14]}
          raycast={() => null}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#9a9589" />
        </mesh>
      ))}
    </group>
  )
}

// River layout shared by every terrain, so placed structures (bridge,
// watermill, lighthouse) always sit against water regardless of terrain.
const riverBedBlobs: Array<[number, number, number, number, number]> = [
  [13, -22, 4.2, 5.2, -0.15],
  [12, -15, 4.4, 5.4, -0.2],
  [13, -8, 4.2, 5.2, 0.08],
  [16, -1, 4.6, 5.8, 0.28],
  [18, 6, 4.3, 5.4, 0.08],
  [17, 13, 4.4, 5.6, -0.12],
  [15, 20, 4, 5, -0.22],
]

const riverWaterBlobs: WaterBlob[] = riverBedBlobs.map(
  ([x, z, width, length, rotation]) => [
    x,
    z,
    width * 0.92,
    length * 0.96,
    rotation,
  ],
)

function SharedRiver() {
  return (
    <group>
      {/* Opaque river bed shows through the water edges as depth */}
      <CurvedPath color="#2b6488" points={riverBedBlobs} />
      <RiverWater blobs={riverWaterBlobs} />
    </group>
  )
}

function DistantMountains({ terrainMode }: { terrainMode: TerrainMode }) {
  if (terrainMode === 'Courtyard') {
    return null
  }

  const frontColor =
    terrainMode === 'Riverbank' ? '#7a9c78' :
    terrainMode === 'Field Path' ? '#7a9860' : '#788c62'

  const midColor =
    terrainMode === 'Riverbank' ? '#5c8070' :
    terrainMode === 'Field Path' ? '#607858' : '#607068'

  const farColor =
    terrainMode === 'Riverbank' ? '#4a6e6e' :
    terrainMode === 'Field Path' ? '#506858' : '#526268'

  return (
    <group raycast={() => null}>
      {/* Far ridge */}
      <group position={[0, 0, -38]}>
        <mesh geometry={farRidgeGeo}>
          <meshStandardMaterial color={farColor} roughness={0.95} transparent opacity={0.21} depthWrite={false} />
        </mesh>
        {/* Snow caps on two tallest far peaks */}
        <mesh position={[-4, 13.2, 5]} scale={[7.5, 3.8, 6]}>
          <coneGeometry args={[1, 1, 9]} />
          <meshStandardMaterial color="#e8f4f8" roughness={0.7} transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <mesh position={[-23, 8.0, 5]} scale={[4.5, 2.2, 4]}>
          <coneGeometry args={[1, 1, 9]} />
          <meshStandardMaterial color="#e8f4f8" roughness={0.7} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      </group>
      {/* Mid ridge */}
      <group position={[0, 0, -29]}>
        <mesh geometry={midRidgeGeo}>
          <meshStandardMaterial color={midColor} roughness={0.93} transparent opacity={0.36} depthWrite={false} />
        </mesh>
        {/* Snow cap on tallest mid peak */}
        <mesh position={[3, 8.8, 4]} scale={[5.5, 2.5, 5]}>
          <coneGeometry args={[1, 1, 9]} />
          <meshStandardMaterial color="#ddeef5" roughness={0.75} transparent opacity={0.30} depthWrite={false} />
        </mesh>
      </group>
      {/* Front ridge — closest, sharpest, no snow */}
      <group position={[0, 0, -23.8]}>
        <mesh geometry={frontRidgeGeo}>
          <meshStandardMaterial color={frontColor} roughness={0.92} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function EdgeWaterAndBeach({ terrainMode }: { terrainMode: TerrainMode }) {
  if (terrainMode !== 'Riverbank') {
    return null
  }

  return (
    <group raycast={() => null}>
      <OrganicPatch
        color="#d5bf8e"
        opacity={0.78}
        pieces={[
          { position: [20.7, 0.02, -16], scale: [3.7, 8.5, 1], rotation: -0.2 },
          { position: [22, 0.021, -6], scale: [3.2, 7, 1], rotation: 0.15 },
          { position: [21.5, 0.022, 13], scale: [3.4, 7.8, 1], rotation: -0.08 },
        ]}
      />
      {/* Sea edge behind the beach */}
      <group position={[24.4, 0.02, -2]} rotation={[0, 0.08, 0]} scale={[4.8, 1, 27]}>
        <PondWater radius={1} opacity={0.8} />
      </group>
    </group>
  )
}

function SmallLake({ terrainMode }: { terrainMode: TerrainMode }) {
  if (terrainMode !== 'Field Path' && terrainMode !== 'Empty Field') {
    return null
  }

  return (
    <group raycast={() => null}>
      {/* Sandy shoreline */}
      <OrganicPatch
        color="#d2bc86"
        opacity={0.58}
        pieces={[
          { position: [-18.1, 0.018, -14.8], scale: [4.3, 1.3, 1], rotation: 0.22 },
          { position: [-14.2, 0.018, -17.3], scale: [2.5, 1.1, 1], rotation: -0.35 },
        ]}
      />
      {/* Animated lake surface */}
      <group position={[-17.4, 0.022, -17.4]} rotation={[0, 0.28, 0]} scale={[3.9, 1, 2.6]}>
        <PondWater radius={1} opacity={0.82} />
      </group>
    </group>
  )
}

function WetGroundOverlay({ strength }: { strength: number }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.019, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[boardSize, boardSize]} />
      <meshStandardMaterial
        color="#6f7e79"
        transparent
        opacity={strength}
        roughness={0.22}
        metalness={0.04}
      />
    </mesh>
  )
}

function SnowGroundOverlay({ opacity }: { opacity: number }) {
  const snowTexture = useMemo(() => createSnowTexture(), [])

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.021, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[boardSize, boardSize]} />
        <meshStandardMaterial
          color="#eef5f5"
          map={snowTexture}
          transparent
          opacity={opacity}
          roughness={0.98}
        />
      </mesh>
      <OrganicPatch
        color="#ffffff"
        opacity={0.36}
        pieces={[
          { position: [-18, 0.024, -8], scale: [8, 5.2, 1], rotation: 0.2 },
          { position: [-4, 0.025, 17], scale: [7.6, 5.8, 1], rotation: -0.35 },
          { position: [10, 0.026, -15], scale: [9, 5.4, 1], rotation: 0.25 },
          { position: [18, 0.027, 6], scale: [6.8, 4.8, 1], rotation: -0.15 },
        ]}
      />
    </group>
  )
}

function TerrainGrid({
  cameraMode,
  isGridVisible,
}: {
  cameraMode: 'build' | 'walk'
  isGridVisible: boolean
}) {
  const gridRef = useRef<GridHelper>(null)
  const opacity = cameraMode === 'walk' ? 0.04 : 0.35
  const visible = isGridVisible

  useFrame(() => {
    const material = gridRef.current?.material
    const materials = Array.isArray(material) ? material : [material]

    materials.forEach((item) => {
      if (!item) {
        return
      }

      item.transparent = true
      item.opacity = opacity
      item.depthWrite = false
    })
  })

  if (!visible) {
    return null
  }

  return (
    <gridHelper
      ref={gridRef}
      args={[boardSize, boardSize, '#b9ab91', '#cfc3aa']}
      position={[0, 0.012, 0]}
      raycast={() => null}
    />
  )
}

function TerrainDetails({ terrainMode }: { terrainMode: TerrainMode }) {
  if (terrainMode === 'Village Road') {
    return (
      <>
        <CurvedPath
          color="#9b7a55"
          points={[
            [-21, -22, 2, 3.8, -0.45],
            [-17, -17, 2.2, 4, -0.35],
            [-13, -11, 2.1, 4.4, -0.25],
            [-8, -5, 2.3, 4.4, -0.18],
            [-2, 0, 2.4, 4.8, 0.14],
            [4, 5, 2.3, 4.8, 0.35],
            [11, 9, 2.1, 4.4, 0.55],
            [18, 13, 2, 4, 0.4],
          ]}
        />
        <OrganicPatch
          color="#8fae70"
          opacity={0.9}
          pieces={[
            { position: [-18, 0.014, 8], scale: [4.8, 2.8, 1], rotation: 0.2 },
            { position: [-21, 0.014, 2], scale: [3.6, 2.2, 1], rotation: -0.4 },
            { position: [16, 0.014, -10], scale: [5.2, 3.2, 1], rotation: -0.25 },
            { position: [20, 0.014, 6], scale: [3.6, 2.5, 1], rotation: 0.35 },
          ]}
        />
      </>
    )
  }

  if (terrainMode === 'Courtyard') {
    return (
      <>
        <OrganicPatch
          color="#b9ad9a"
          pieces={[
            { position: [-6, 0.014, -4], scale: [7.5, 5.8, 1], rotation: 0.15 },
            { position: [5, 0.015, -2.5], scale: [8, 6.5, 1], rotation: -0.1 },
            { position: [-2, 0.016, 5.5], scale: [7.8, 5.4, 1], rotation: 0.35 },
            { position: [7, 0.017, 6], scale: [5.4, 4.2, 1], rotation: -0.25 },
          ]}
        />
        <OrganicPatch
          color="#839f68"
          opacity={0.85}
          pieces={[
            { position: [-19, 0.018, -16], scale: [5, 3, 1], rotation: 0.25 },
            { position: [18, 0.018, 15], scale: [5.8, 3.4, 1], rotation: -0.2 },
            { position: [17, 0.018, -15], scale: [4.6, 2.7, 1], rotation: 0.1 },
          ]}
        />
      </>
    )
  }

  if (terrainMode === 'Field Path') {
    return (
      <>
        <OrganicPatch
          color="#c7b96d"
          opacity={0.92}
          pieces={[
            { position: [-17, 0.014, -5], scale: [6, 9, 1], rotation: -0.15 },
            { position: [-18, 0.015, 7], scale: [5.2, 7.4, 1], rotation: 0.2 },
            { position: [-10, 0.016, 2], scale: [4.8, 8, 1], rotation: 0.1 },
            { position: [-3, 0.017, -12], scale: [5.2, 6.8, 1], rotation: -0.2 },
          ]}
        />
        <CurvedPath
          color="#94714f"
          points={[
            [9, -21, 1.5, 3.2, -0.1],
            [7, -16, 1.6, 3.5, -0.25],
            [5, -10, 1.7, 3.6, -0.15],
            [5, -3, 1.6, 3.5, 0.12],
            [8, 4, 1.7, 3.7, 0.3],
            [12, 10, 1.6, 3.4, 0.45],
            [17, 16, 1.5, 3.2, 0.32],
          ]}
        />
      </>
    )
  }

  if (terrainMode === 'Empty Field') {
    return (
      <OrganicPatch
        color="#8ead68"
        opacity={0.34}
        pieces={[
          { position: [-16, 0.014, -14], scale: [7, 5, 1], rotation: 0.18 },
          { position: [3, 0.014, -18], scale: [8.5, 4.8, 1], rotation: -0.25 },
          { position: [15, 0.014, 6], scale: [7.4, 5.2, 1], rotation: 0.3 },
          { position: [-10, 0.014, 15], scale: [8, 5.6, 1], rotation: -0.12 },
        ]}
      />
    )
  }

  return (
    <>
      {/* River bank sand shoulders — the river itself is rendered globally */}
      <OrganicPatch
        color="#cbb88d"
        opacity={0.9}
        pieces={[
          { position: [7.2, 0.018, -16], scale: [2.5, 5.5, 1], rotation: 0.1 },
          { position: [9, 0.018, 4], scale: [2.6, 6, 1], rotation: -0.35 },
          { position: [8, 0.018, 18], scale: [2.5, 4.6, 1], rotation: 0.25 },
          { position: [21.2, 0.018, -2], scale: [2.3, 4, 1], rotation: -0.1 },
          { position: [22, 0.018, 12], scale: [2.2, 3.5, 1], rotation: 0.22 },
        ]}
      />
    </>
  )
}

function TerrainEdgeShadows({ terrainMode }: { terrainMode: TerrainMode }) {
  const color = terrainMode === 'Courtyard' ? '#5a5044' : '#2e4a20'
  const opacity = terrainMode === 'Courtyard' ? 0.07 : 0.09

  return (
    <OrganicPatch
      color={color}
      opacity={opacity}
      pieces={[
        { position: [-20, 0.006, -16], scale: [13, 11, 1], rotation: 0.1 },
        { position: [19, 0.006, -17], scale: [12, 11, 1], rotation: -0.15 },
        { position: [-20, 0.006, 16], scale: [13, 10, 1], rotation: 0.2 },
        { position: [18, 0.006, 17], scale: [12, 11, 1], rotation: -0.1 },
        { position: [0, 0.006, -22], scale: [22, 6, 1], rotation: 0 },
        { position: [0, 0.006, 22], scale: [22, 6, 1], rotation: 0 },
        { position: [-22, 0.006, 0], scale: [6, 22, 1], rotation: 0 },
        { position: [22, 0.006, 0], scale: [6, 22, 1], rotation: 0 },
      ]}
    />
  )
}

function TerrainBackdrop({ terrainMode }: { terrainMode: TerrainMode }) {
  return (
    <>
      <DistantMountains terrainMode={terrainMode} />
      <EdgeWaterAndBeach terrainMode={terrainMode} />
      <SmallLake terrainMode={terrainMode} />
    </>
  )
}

export function GroundPlane({
  terrainMode,
  cameraMode,
  isGridVisible,
  onGroundClick,
  onGroundPointerMove,
}: GroundPlaneProps) {
  const weather = useSceneStore((state) => state.weather)
  const weatherIntensity = useSceneStore((state) => state.weatherIntensity)
  const worldStyle = useSceneStore((state) => state.worldStyle)
  const terrainTexture = useMemo(() => createTerrainTexture(terrainMode), [
    terrainMode,
  ])
  const baseColor =
    terrainMode === 'Courtyard'
      ? '#cfc5b4'
      : terrainMode === 'Field Path'
        ? '#a9bf7a'
        : terrainMode === 'Riverbank'
          ? '#8fba73'
          : terrainMode === 'Empty Field'
            ? '#91b877'
          : '#b9a67f'

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={onGroundClick}
        onPointerMove={onGroundPointerMove}
      >
        <planeGeometry args={[boardSize, boardSize]} />
        <meshStandardMaterial
          color={baseColor}
          map={terrainTexture}
          roughness={0.96}
        />
      </mesh>
      <GrassTextureLayer />
      <TerrainEdgeShadows terrainMode={terrainMode} />
      <TerrainDetails terrainMode={terrainMode} />
      <SharedRiver />
      {/* Only the horizon changes between worlds — the island itself keeps its
          scatter and grass, which is the whole point of it drifting. */}
      {worldStyle === 'cyber' ? <CityBackdrop /> : null}
      {worldStyle === 'space' ? <SpaceBackdrop /> : null}
      {worldStyle === 'natural' ? (
        <TerrainBackdrop terrainMode={terrainMode} />
      ) : null}
      <TerrainScatter />
      <GrassField terrainMode={terrainMode} />
      <GardenRoute />
      {weather === 'rain' || weather === 'storm' ? (
        <WetGroundOverlay
          strength={(weather === 'storm' ? 0.18 : 0.08) * weatherIntensity}
        />
      ) : null}
      {weather === 'snow' ? (
        <SnowGroundOverlay opacity={0.68 * weatherIntensity} />
      ) : null}
      <TerrainGrid
        cameraMode={cameraMode}
        isGridVisible={isGridVisible}
      />
    </group>
  )
}
