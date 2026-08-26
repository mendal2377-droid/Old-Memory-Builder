export type AssetCategory =
  | 'HOUSES'
  | 'Animals'
  | 'Trees'
  | 'Plants'
  | 'Flowers'
  | 'Rocks'
  | 'Paths'
  | 'Water'
  | 'Props'

export type ModelPath = `${string}.glb` | `${string}.gltf`

export interface AssetDefinition {
  id: string
  name: string
  category: AssetCategory
  kind?:
    | 'model'
    | 'water'
    | 'cabin'
    | 'barn'
    | 'mill'
    | 'bridge'
    | 'lighthouse'
    | 'woodpile'
  path?: ModelPath
  defaultScale: [number, number, number]
  defaultRotation: [number, number, number]
  yOffset: number
  collisionRadius?: number
}

export interface SceneObject {
  id: string
  assetId: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type TerrainMode =
  | 'Village Road'
  | 'Courtyard'
  | 'Field Path'
  | 'Riverbank'
  | 'Empty Field'

export type AtmospherePreset =
  | 'Clear Morning'
  | 'Golden Morning'
  | 'Cosmic Dawn'
  | 'Sunset'
  | 'Rainy Day'
  | 'Heavy Rain'
  | 'Snowy Day'
  | 'Summer Night'

export interface ScenePreset {
  id: string
  name: string
  objects: SceneObject[]
}

export type MemoryKitCategory =
  | 'Nature Corners'
  | 'Water Corners'
  | 'Path Corners'

export interface MemoryKitObject {
  assetId: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface MemoryKitDefinition {
  id: string
  name: string
  category: MemoryKitCategory
  objects: MemoryKitObject[]
}

export interface SceneTemplateDefinition {
  id: string
  name: string
  jsonPath?: string
  type: 'Garden' | 'Forest' | 'Riverbank' | 'Custom'
  season: 'Spring' | 'Summer' | 'Autumn' | 'Winter' | 'Any'
  description: string
  terrainMode: TerrainMode
  atmospherePreset: AtmospherePreset
  thumbnail: 'autumn' | 'forest' | 'river'
  objects: MemoryKitObject[]
}
