import { useMemo } from 'react'
import { assets } from '../../data/assets'
import { useSceneStore } from '../../store/sceneStore'

const MAP_SIZE = 150
const WORLD_HALF = 24 // world spans roughly -24..24 on each axis

// River centreline blobs [x, z, halfWidth, halfLength] — mirrors the scene river
const riverBlobs: Array<[number, number, number, number]> = [
  [13, -22, 4.2, 5.2],
  [12, -15, 4.4, 5.4],
  [13, -8, 4.2, 5.2],
  [16, -1, 4.6, 5.8],
  [18, 6, 4.3, 5.4],
  [17, 13, 4.4, 5.6],
  [15, 20, 4, 5],
]

function toSvg(x: number, z: number): [number, number] {
  const sx = ((x + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE
  const sy = ((z + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE
  return [sx, sy]
}

function scale(units: number) {
  return (units / (WORLD_HALF * 2)) * MAP_SIZE
}

interface Marker {
  x: number
  z: number
  kind: 'house' | 'bridge' | 'woodpile' | 'lighthouse'
}

export function Minimap() {
  const walkPose = useSceneStore((state) => state.walkPose)
  const sceneObjects = useSceneStore((state) => state.sceneObjects)
  const gameMode = useSceneStore((state) => state.gameMode)
  const gameTasks = useSceneStore((state) => state.gameTasks)

  const markers = useMemo<Marker[]>(() => {
    const result: Marker[] = []
    for (const object of sceneObjects) {
      const asset = assets.find((item) => item.id === object.assetId)
      if (!asset) continue
      const x = object.position[0]
      const z = object.position[2]
      if (asset.kind === 'lighthouse') {
        result.push({ x, z, kind: 'lighthouse' })
      } else if (asset.kind === 'bridge') {
        result.push({ x, z, kind: 'bridge' })
      } else if (asset.kind === 'woodpile') {
        result.push({ x, z, kind: 'woodpile' })
      } else if (asset.category === 'HOUSES') {
        result.push({ x, z, kind: 'house' })
      }
    }
    return result
  }, [sceneObjects])

  if (!walkPose) {
    return null
  }

  // Which marker is the current objective during the game?
  let objectiveKind: Marker['kind'] | null = null
  if (gameMode === 'playing') {
    if (!gameTasks.collectWood) objectiveKind = 'woodpile'
    else if (!gameTasks.repairBridge) objectiveKind = 'bridge'
    else objectiveKind = 'lighthouse'
  }

  const [px, py] = toSvg(walkPose.x, walkPose.z)
  // Arrow points up by default; rotate to the walk heading (forward = +z at yaw 0)
  const headingDeg =
    (Math.atan2(Math.sin(walkPose.yaw), -Math.cos(walkPose.yaw)) * 180) /
    Math.PI

  const markerColor: Record<Marker['kind'], string> = {
    house: '#c9a06a',
    bridge: '#9a6a44',
    woodpile: '#8a5a34',
    lighthouse: '#e0554a',
  }

  return (
    <div className="minimap" aria-label="Area overview">
      <svg
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        width={MAP_SIZE}
        height={MAP_SIZE}
      >
        {/* Land background */}
        <rect
          x={0}
          y={0}
          width={MAP_SIZE}
          height={MAP_SIZE}
          rx={10}
          fill="#5f7d4a"
        />
        {/* River */}
        <g opacity={0.85}>
          {riverBlobs.map(([x, z, hw, hl], index) => {
            const [cx, cy] = toSvg(x, z)
            return (
              <ellipse
                key={`river-${index}`}
                cx={cx}
                cy={cy}
                rx={scale(hw)}
                ry={scale(hl)}
                fill="#3b82ab"
              />
            )
          })}
        </g>

        {/* Structure markers */}
        {markers.map((marker, index) => {
          const [cx, cy] = toSvg(marker.x, marker.z)
          const isObjective = marker.kind === objectiveKind
          const radius = marker.kind === 'lighthouse' ? 4.5 : 3
          return (
            <g key={`marker-${index}`}>
              {isObjective ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={9}
                  className="minimap-objective-ring"
                  fill="none"
                  stroke="#ffd88a"
                  strokeWidth={1.6}
                />
              ) : null}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={markerColor[marker.kind]}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.8}
              />
            </g>
          )
        })}

        {/* Player arrow */}
        <g transform={`translate(${px} ${py}) rotate(${headingDeg})`}>
          <path
            d="M 0 -6 L 4 5 L 0 2.5 L -4 5 Z"
            fill="#ffffff"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.8}
          />
        </g>
      </svg>
    </div>
  )
}
