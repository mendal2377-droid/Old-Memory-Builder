import { create } from 'zustand'
import { assets } from '../data/assets'
import { memoryKits } from '../data/memoryKits'
import { sceneTemplates } from '../data/sceneTemplates'
import type {
  AtmospherePreset,
  SceneObject,
  TerrainMode,
} from '../types/scene'

const sceneStorageKey = 'old-memory-builder-scene'
const defaultTerrainMode: TerrainMode = 'Riverbank'
const defaultAtmospherePreset: AtmospherePreset = 'Clear Morning'
const terrainLimit = 23
const sceneFileVersion = 1

interface ScatterOptions {
  count: number
  radius: number
  randomScale: boolean
  randomRotation: boolean
}

interface SavedSceneObject extends SceneObject {
  category?: string
}

interface SavedSceneState {
  version: number
  savedAt: string
  terrainMode: TerrainMode
  atmospherePreset: AtmospherePreset
  isGridVisible: boolean
  cameraMode: 'build' | 'walk'
  sceneObjects: SavedSceneObject[]
}

interface MemoryPoint {
  title: string
  text: string
  sound: 'birds' | 'water' | 'wind' | 'soft'
}

function clampToTerrain(value: number) {
  return Math.min(terrainLimit, Math.max(-terrainLimit, value))
}

function createSceneObject(
  assetId: string,
  objectCount: number,
  position?: [number, number, number],
): SceneObject {
  const asset = assets.find((item) => item.id === assetId)
  const column = objectCount % 4
  const row = Math.floor(objectCount / 4)

  return {
    id: crypto.randomUUID(),
    assetId,
    position: position ?? [(column - 1.5) * 1.4, 0, row * 1.4 - 1.4],
    rotation: asset?.defaultRotation ?? [0, 0, 0],
    scale: asset?.defaultScale ?? [1, 1, 1],
  }
}

function createDuplicatedObject(
  source: SceneObject,
  offset: [number, number],
  randomRotation: boolean,
  scaleFactor = 1,
): SceneObject {
  return {
    id: crypto.randomUUID(),
    assetId: source.assetId,
    position: [
      clampToTerrain(source.position[0] + offset[0]),
      0,
      clampToTerrain(source.position[2] + offset[1]),
    ],
    rotation: [
      source.rotation[0],
      randomRotation
        ? source.rotation[1] + Math.random() * Math.PI * 2
        : source.rotation[1],
      source.rotation[2],
    ],
    scale: [
      source.scale[0] * scaleFactor,
      source.scale[1] * scaleFactor,
      source.scale[2] * scaleFactor,
    ],
  }
}

function getScatterRadius(object: SceneObject) {
  const asset = assets.find((item) => item.id === object.assetId)
  const maxScale = Math.max(object.scale[0], object.scale[2])

  if (!asset) {
    return 0.55 * maxScale
  }

  if (asset.collisionRadius) {
    return asset.collisionRadius * maxScale
  }

  if (asset.category === 'Trees') {
    return 0.75 * maxScale
  }

  if (asset.category === 'Rocks' || asset.category === 'Animals') {
    return 0.65 * maxScale
  }

  if (asset.category === 'Water') {
    return asset.id.includes('pond') ? 1.25 * maxScale : 0.85 * maxScale
  }

  return 0.45 * maxScale
}

function isTooCloseToObjects(
  candidate: SceneObject,
  objects: SceneObject[],
  minGap = 0.3,
) {
  const candidateRadius = getScatterRadius(candidate)

  return objects.some((object) => {
    if (object.id === candidate.id) {
      return false
    }

    const distance = Math.hypot(
      object.position[0] - candidate.position[0],
      object.position[2] - candidate.position[2],
    )

    return distance < candidateRadius + getScatterRadius(object) + minGap
  })
}

function isInsidePlacedWater(candidate: SceneObject, objects: SceneObject[]) {
  const candidateAsset = assets.find((asset) => asset.id === candidate.assetId)

  if (candidateAsset?.category === 'Water') {
    return false
  }

  return objects.some((object) => {
    const asset = assets.find((item) => item.id === object.assetId)

    if (asset?.category !== 'Water') {
      return false
    }

    const distance = Math.hypot(
      object.position[0] - candidate.position[0],
      object.position[2] - candidate.position[2],
    )

    return distance < getScatterRadius(object) + 0.55
  })
}

function createStarterObjects(): SceneObject[] {
  const seed: Array<{
    assetId: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale?: [number, number, number]
  }> = [
    // Wooden cabins scattered in the left half (river is on the right at x ~13-18)
    { assetId: 'cabin_01', position: [-12, 0, -6], rotation: [0, 0.35, 0] },
    { assetId: 'cabin_03', position: [-5, 0, -10], rotation: [0, -0.95, 0] },
    { assetId: 'cabin_05', position: [-15, 0, 3], rotation: [0, 1.85, 0] },
    { assetId: 'cabin_04', position: [-7, 0, 6], rotation: [0, 2.6, 0] },
    { assetId: 'cabin_01', position: [-13, 0, 13], rotation: [0, 0.7, 0] },

    // Barn on the village edge
    { assetId: 'barn_01', position: [-18, 0, -2], rotation: [0, 0.6, 0] },

    // Watermill on the river bank (wheel facing the river)
    { assetId: 'mill_01', position: [11, 0, -3], rotation: [0, 0, 0] },

    // Wooden bridge crossing the river — length along X spans both banks
    { assetId: 'bridge_01', position: [16, 0, 0], rotation: [0, 0, 0] },

    // Lighthouse on the east beach overlooking the water
    { assetId: 'lighthouse_01', position: [21, 0, 8], rotation: [0, -0.4, 0] },

    // Woodpile on the west bank — firewood source for the Storm Game
    { assetId: 'woodpile_01', position: [3, 0, 7], rotation: [0, 0.5, 0] },

    // Trees around the village
    { assetId: 'pine_3', position: [-18, 0, -9], rotation: [0, 0.6, 0], scale: [1.1, 1.1, 1.1] },
    { assetId: 'pine_2', position: [-10, 0, -14], rotation: [0, 1.2, 0] },
    { assetId: 'commontree_2', position: [-1, 0, -6], rotation: [0, 0.3, 0] },
    { assetId: 'commontree_3', position: [-18, 0, 9], rotation: [0, 1.8, 0] },
    { assetId: 'pine_4', position: [-9, 0, 18], rotation: [0, 0.9, 0] },
    { assetId: 'twistedtree_2', position: [-2, 0, 14], rotation: [0, 0.4, 0] },
    { assetId: 'pine_1', position: [-19, 0, -3], rotation: [0, 1.5, 0] },
    { assetId: 'commontree_4', position: [2, 0, 4], rotation: [0, 0.8, 0] },

    // Bushes for groundcover
    { assetId: 'bush_common', position: [-8, 0, -1], rotation: [0, 0, 0] },
    { assetId: 'bush_common', position: [-4, 0, 2], rotation: [0, 1.0, 0] },
    { assetId: 'bush_common_flowers', position: [-11, 0, 8], rotation: [0, 0.5, 0] },

    // Animal for life
    { assetId: 'deer_01', position: [-3, 0, -2], rotation: [0, 1.2, 0] },
  ]

  const availableAssetIds = new Set(assets.map((asset) => asset.id))

  return seed
    .filter((entry) => availableAssetIds.has(entry.assetId))
    .map((entry) => {
      const asset = assets.find((item) => item.id === entry.assetId)
      return {
        id: crypto.randomUUID(),
        assetId: entry.assetId,
        position: entry.position,
        rotation: entry.rotation,
        scale: entry.scale ?? asset?.defaultScale ?? [1, 1, 1],
      }
    })
}

function createKitObjects(
  kitId: string,
  origin: [number, number, number],
): SceneObject[] {
  const kit = memoryKits.find((item) => item.id === kitId)

  if (!kit) {
    return []
  }

  return kit.objects
    .filter((kitObject) =>
      assets.some((asset) => asset.id === kitObject.assetId),
    )
    .map((kitObject) => ({
      id: crypto.randomUUID(),
      assetId: kitObject.assetId,
      position: [
        clampToTerrain(origin[0] + kitObject.position[0]),
        0,
        clampToTerrain(origin[2] + kitObject.position[2]),
      ],
      rotation: kitObject.rotation,
      scale: kitObject.scale,
    }))
}

function createTemplateObjects(templateId: string): SceneObject[] {
  const template = sceneTemplates.find((item) => item.id === templateId)

  if (!template) {
    return []
  }

  return template.objects
    .filter((templateObject) =>
      assets.some((asset) => asset.id === templateObject.assetId),
    )
    .map((templateObject) => ({
      id: crypto.randomUUID(),
      assetId: templateObject.assetId,
      position: [
        clampToTerrain(templateObject.position[0]),
        0,
        clampToTerrain(templateObject.position[2]),
      ],
      rotation: templateObject.rotation,
      scale: templateObject.scale,
    }))
}

function hasEnoughValidKitAssets(kitId: string) {
  const kit = memoryKits.find((item) => item.id === kitId)

  if (!kit) {
    return false
  }

  const availableAssetIds = new Set(assets.map((asset) => asset.id))

  return (
    kit.objects.filter((kitObject) =>
      availableAssetIds.has(kitObject.assetId),
    ).length >= 2
  )
}

const maxUndoDepth = 24

export const gameDurationSeconds = 300

export type GameMode = 'sandbox' | 'briefing' | 'playing' | 'won' | 'lost'

export interface GameTasks {
  collectWood: boolean
  repairBridge: boolean
}

interface SceneState {
  sceneObjects: SceneObject[]
  undoStack: SceneObject[][]
  gameMode: GameMode
  gameStartedAt: number | null
  gameTimeRemaining: number
  gameTasks: GameTasks
  gamePrompt: string | null
  gamePromptProgress: number
  walkPose: { x: number; z: number; yaw: number } | null
  terrainMode: TerrainMode
  atmospherePreset: AtmospherePreset
  isMuted: boolean
  isGridVisible: boolean
  areAnimalsWalking: boolean
  cameraMode: 'build' | 'walk'
  isCameraTransitioning: boolean
  selectedObjectId: string | null
  placementAssetId: string | null
  placementKitId: string | null
  activeSceneTemplateId: string | null
  activeMemoryPoint: MemoryPoint | null
  lastScatterObjectIds: string[]
  screenshotRequestId: number
  screenshotMessage: string
  modelLoadWarning: string
  beginBriefing: () => void
  startGame: () => void
  winGame: () => void
  loseGame: () => void
  exitGame: () => void
  setGameTimeRemaining: (seconds: number) => void
  completeTask: (task: keyof GameTasks) => void
  setGamePrompt: (label: string | null, progress: number) => void
  setWalkPose: (pose: { x: number; z: number; yaw: number } | null) => void
  undo: () => void
  addObject: (assetId: string) => void
  setPlacementAsset: (assetId: string) => void
  setPlacementKit: (kitId: string) => void
  cancelPlacement: () => void
  placeObject: (assetId: string, position: [number, number, number]) => void
  placeKit: (kitId: string, position: [number, number, number]) => void
  selectObject: (id: string | null) => void
  moveSelected: (dx: number, dz: number) => void
  rotateSelected: () => void
  scaleSelected: (factor: number) => void
  deleteSelected: () => void
  duplicateSelected: (count?: number) => void
  scatterSelected: (options: ScatterOptions) => void
  cancelLastScatter: () => void
  saveScene: () => void
  loadScene: () => boolean
  autoSaveScene: () => void
  clearSavedScene: () => void
  exportScene: () => string
  importScene: (json: string) => boolean
  loadSceneTemplate: (templateId: string) => boolean
  openMemoryPoint: (memoryPoint: MemoryPoint) => void
  closeMemoryPoint: () => void
  setTerrainMode: (terrainMode: TerrainMode) => void
  setAtmospherePreset: (preset: AtmospherePreset) => void
  toggleMute: () => void
  toggleGrid: () => void
  toggleAnimalsWalking: () => void
  updateObjectMotion: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
  ) => void
  requestScreenshot: () => void
  setScreenshotMessage: (message: string) => void
  reportModelLoadFailure: (path: string) => void
  setCameraMode: (mode: 'build' | 'walk') => void
  setCameraTransitioning: (isTransitioning: boolean) => void
}

function isTerrainMode(value: unknown): value is TerrainMode {
  return (
    value === 'Village Road' ||
    value === 'Courtyard' ||
    value === 'Field Path' ||
    value === 'Riverbank' ||
    value === 'Empty Field'
  )
}

function isAtmospherePreset(value: unknown): value is AtmospherePreset {
  return (
    value === 'Clear Morning' ||
    value === 'Sunset' ||
    value === 'Rainy Day' ||
    value === 'Heavy Rain' ||
    value === 'Snowy Day' ||
    value === 'Summer Night'
  )
}

function isNumberTuple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number')
  )
}

function isSceneObject(value: unknown): value is SceneObject {
  if (!value || typeof value !== 'object') {
    return false
  }

  const object = value as Record<string, unknown>

  return (
    typeof object.id === 'string' &&
    typeof object.assetId === 'string' &&
    isNumberTuple(object.position) &&
    isNumberTuple(object.rotation) &&
    isNumberTuple(object.scale)
  )
}

function createSceneSnapshot(state: SceneState): SavedSceneState {
  return {
    version: sceneFileVersion,
    savedAt: new Date().toISOString(),
    terrainMode: state.terrainMode,
    atmospherePreset: state.atmospherePreset,
    isGridVisible: state.isGridVisible,
    cameraMode: state.cameraMode,
    sceneObjects: state.sceneObjects.map((object) => ({
      id: object.id,
      assetId: object.assetId,
      category: assets.find((asset) => asset.id === object.assetId)?.category,
      position: object.position,
      rotation: object.rotation,
      scale: object.scale,
    })),
  }
}

function parseSceneSnapshot(json: string): SavedSceneState | null {
  try {
    const parsedScene = JSON.parse(json) as {
      sceneObjects?: unknown
      terrainMode?: unknown
      atmospherePreset?: unknown
      isGridVisible?: unknown
      cameraMode?: unknown
    }
    const loadedObjects = Array.isArray(parsedScene.sceneObjects)
      ? parsedScene.sceneObjects.filter(isSceneObject).map((object) => ({
          ...object,
          position: [object.position[0], 0, object.position[2]] as [
            number,
            number,
            number,
          ],
          category: assets.find((asset) => asset.id === object.assetId)
            ?.category,
        }))
      : []

    return {
      version: sceneFileVersion,
      savedAt: new Date().toISOString(),
      sceneObjects: loadedObjects,
      terrainMode: isTerrainMode(parsedScene.terrainMode)
        ? parsedScene.terrainMode
        : defaultTerrainMode,
      atmospherePreset: isAtmospherePreset(parsedScene.atmospherePreset)
        ? parsedScene.atmospherePreset
        : defaultAtmospherePreset,
      isGridVisible:
        typeof parsedScene.isGridVisible === 'boolean'
          ? parsedScene.isGridVisible
          : false,
      cameraMode: parsedScene.cameraMode === 'walk' ? 'walk' : 'build',
    }
  } catch {
    return null
  }
}

export const useSceneStore = create<SceneState>((set, get) => {
  const pushUndo = () => {
    const { sceneObjects, undoStack } = get()
    set({
      undoStack: [...undoStack.slice(-(maxUndoDepth - 1)), [...sceneObjects]],
    })
  }

  return {
  sceneObjects: createStarterObjects(),
  undoStack: [],
  gameMode: 'sandbox' as GameMode,
  gameStartedAt: null,
  gameTimeRemaining: gameDurationSeconds,
  gameTasks: { collectWood: false, repairBridge: false },
  gamePrompt: null,
  gamePromptProgress: 0,
  walkPose: null,
  beginBriefing: () => {
    set({
      gameMode: 'briefing',
      gameStartedAt: null,
      gameTimeRemaining: gameDurationSeconds,
      gameTasks: { collectWood: false, repairBridge: false },
      gamePrompt: null,
      gamePromptProgress: 0,
      atmospherePreset: 'Clear Morning',
      cameraMode: 'walk',
      placementAssetId: null,
      placementKitId: null,
      selectedObjectId: null,
      activeMemoryPoint: null,
    })
  },
  startGame: () => {
    set({
      gameMode: 'playing',
      gameStartedAt: Date.now(),
      gameTimeRemaining: gameDurationSeconds,
      gameTasks: { collectWood: false, repairBridge: false },
      gamePrompt: null,
      gamePromptProgress: 0,
      atmospherePreset: 'Clear Morning',
      cameraMode: 'walk',
      placementAssetId: null,
      placementKitId: null,
      selectedObjectId: null,
      activeMemoryPoint: null,
    })
  },
  winGame: () => {
    if (get().gameMode === 'playing') {
      set({ gameMode: 'won', gamePrompt: null, gamePromptProgress: 0 })
    }
  },
  loseGame: () => {
    if (get().gameMode === 'playing') {
      set({ gameMode: 'lost', gamePrompt: null, gamePromptProgress: 0 })
    }
  },
  exitGame: () => {
    set({
      gameMode: 'sandbox',
      gameStartedAt: null,
      gameTimeRemaining: gameDurationSeconds,
      gameTasks: { collectWood: false, repairBridge: false },
      gamePrompt: null,
      gamePromptProgress: 0,
      walkPose: null,
      cameraMode: 'build',
    })
  },
  setGameTimeRemaining: (seconds) => set({ gameTimeRemaining: seconds }),
  completeTask: (task) =>
    set((state) => ({
      gameTasks: { ...state.gameTasks, [task]: true },
      gamePrompt: null,
      gamePromptProgress: 0,
    })),
  setGamePrompt: (label, progress) => {
    const state = get()
    if (state.gamePrompt === label && state.gamePromptProgress === progress) {
      return
    }
    set({ gamePrompt: label, gamePromptProgress: progress })
  },
  setWalkPose: (pose) => set({ walkPose: pose }),
  terrainMode: defaultTerrainMode,
  atmospherePreset: defaultAtmospherePreset,
  isMuted: true,
  isGridVisible: false,
  areAnimalsWalking: false,
  cameraMode: 'build',
  isCameraTransitioning: false,
  selectedObjectId: null,
  placementAssetId: null,
  placementKitId: null,
  activeSceneTemplateId: null,
  activeMemoryPoint: null,
  lastScatterObjectIds: [],
  screenshotRequestId: 0,
  screenshotMessage: '',
  modelLoadWarning: '',
  undo: () => {
    const { undoStack, cameraMode, isCameraTransitioning } = get()
    if (cameraMode !== 'build' || isCameraTransitioning || undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    set((state) => ({
      sceneObjects: previous,
      undoStack: state.undoStack.slice(0, -1),
      selectedObjectId: null,
    }))
  },
  addObject: (assetId) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    pushUndo()
    const object = createSceneObject(assetId, get().sceneObjects.length)

    set((state) => ({
      sceneObjects: [...state.sceneObjects, object],
      selectedObjectId: object.id,
    }))
  },
  setPlacementAsset: (assetId) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    set({
      placementAssetId: assetId,
      placementKitId: null,
      selectedObjectId: null,
    })
  },
  setPlacementKit: (kitId) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    if (!hasEnoughValidKitAssets(kitId)) {
      set({
        placementKitId: null,
        placementAssetId: null,
        screenshotMessage: 'This kit has unavailable assets and was skipped.',
      })
      return
    }

    set({
      placementKitId: kitId,
      placementAssetId: null,
      selectedObjectId: null,
    })
  },
  cancelPlacement: () =>
    set({ placementAssetId: null, placementKitId: null }),
  placeObject: (assetId, position) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    pushUndo()
    const object = createSceneObject(assetId, get().sceneObjects.length, [
      position[0],
      0,
      position[2],
    ])

    set((state) => ({
      sceneObjects: [...state.sceneObjects, object],
      selectedObjectId: object.id,
      placementAssetId: null,
      placementKitId: null,
    }))
  },
  placeKit: (kitId, position) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    pushUndo()
    const objects = createKitObjects(kitId, [position[0], 0, position[2]])

    if (objects.length < 2) {
      set({
        placementKitId: null,
        placementAssetId: null,
        screenshotMessage: 'This kit has unavailable assets and was skipped.',
      })
      return
    }

    set((state) => ({
      sceneObjects: [...state.sceneObjects, ...objects],
      selectedObjectId: objects[objects.length - 1].id,
      placementAssetId: null,
      placementKitId: null,
      screenshotMessage: 'Memory kit placed.',
    }))
  },
  selectObject: (id) => {
    if (get().cameraMode !== 'build' || get().isCameraTransitioning) {
      return
    }

    set({ selectedObjectId: id })
  },
  moveSelected: (dx, dz) => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    set((state) => ({
      sceneObjects: state.sceneObjects.map((object) =>
        object.id === selectedObjectId
          ? {
              ...object,
              position: [
                object.position[0] + dx,
                0,
                object.position[2] + dz,
              ],
            }
          : object,
      ),
    }))
  },
  rotateSelected: () => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    set((state) => ({
      sceneObjects: state.sceneObjects.map((object) =>
        object.id === selectedObjectId
          ? {
              ...object,
              rotation: [
                object.rotation[0],
                object.rotation[1] + Math.PI / 2,
                object.rotation[2],
              ],
            }
          : object,
      ),
    }))
  },
  scaleSelected: (factor) => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    set((state) => ({
      sceneObjects: state.sceneObjects.map((object) =>
        object.id === selectedObjectId
          ? {
              ...object,
              scale: [
                object.scale[0] * factor,
                object.scale[1] * factor,
                object.scale[2] * factor,
              ],
            }
          : object,
      ),
    }))
  },
  deleteSelected: () => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    set((state) => ({
      sceneObjects: state.sceneObjects.filter(
        (object) => object.id !== selectedObjectId,
      ),
      selectedObjectId: null,
    }))
  },
  duplicateSelected: (count = 1) => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    const source = get().sceneObjects.find(
      (object) => object.id === selectedObjectId,
    )

    if (!source) {
      return
    }

    const copies = Array.from({ length: count }, (_, index) => {
      const ring = index + 1
      const angle =
        count === 1 ? Math.PI / 4 : (index / count) * Math.PI * 2 + Math.random() * 0.35
      const distance = count === 1 ? 1.25 : 1.2 + Math.sqrt(ring) * 0.75

      return createDuplicatedObject(
        source,
        [
          Math.cos(angle) * distance + (Math.random() - 0.5) * 0.45,
          Math.sin(angle) * distance + (Math.random() - 0.5) * 0.45,
        ],
        count > 1,
      )
    })

    set((state) => ({
      sceneObjects: [...state.sceneObjects, ...copies],
      selectedObjectId: copies[copies.length - 1]?.id ?? selectedObjectId,
      lastScatterObjectIds: [],
    }))
  },
  scatterSelected: ({ count, radius, randomScale, randomRotation }) => {
    const { cameraMode, isCameraTransitioning, selectedObjectId } = get()

    if (cameraMode !== 'build' || isCameraTransitioning || !selectedObjectId) {
      return
    }

    pushUndo()
    const source = get().sceneObjects.find(
      (object) => object.id === selectedObjectId,
    )

    if (!source) {
      return
    }

    const safeCount = Math.min(80, Math.max(1, Math.round(count)))
    const safeRadius = Math.min(terrainLimit, Math.max(0.5, radius))
    const copies: SceneObject[] = []
    let attempts = 0

    while (copies.length < safeCount && attempts < safeCount * 22) {
      attempts += 1
      const angle = Math.random() * Math.PI * 2
      const distance = Math.sqrt(Math.random()) * safeRadius
      const scaleFactor = randomScale ? 0.82 + Math.random() * 0.36 : 1

      const candidate = createDuplicatedObject(
        source,
        [Math.cos(angle) * distance, Math.sin(angle) * distance],
        randomRotation,
        scaleFactor,
      )
      const placedObjects = [...get().sceneObjects, ...copies]

      if (
        !isTooCloseToObjects(candidate, placedObjects, 0.2) &&
        !isInsidePlacedWater(candidate, placedObjects)
      ) {
        copies.push(candidate)
      }
    }

    set((state) => ({
      sceneObjects: [...state.sceneObjects, ...copies],
      selectedObjectId: copies[copies.length - 1]?.id ?? selectedObjectId,
      lastScatterObjectIds: copies.map((copy) => copy.id),
    }))
  },
  cancelLastScatter: () => {
    const { lastScatterObjectIds } = get()

    if (lastScatterObjectIds.length === 0) {
      return
    }

    const scatterIds = new Set(lastScatterObjectIds)

    set((state) => ({
      sceneObjects: state.sceneObjects.filter(
        (object) => !scatterIds.has(object.id),
      ),
      selectedObjectId: scatterIds.has(state.selectedObjectId ?? '')
        ? null
        : state.selectedObjectId,
      lastScatterObjectIds: [],
    }))
  },
  saveScene: () => {
    localStorage.setItem(sceneStorageKey, JSON.stringify(createSceneSnapshot(get())))
  },
  loadScene: () => {
    const savedScene = localStorage.getItem(sceneStorageKey)

    if (!savedScene) {
      return false
    }

    const snapshot = parseSceneSnapshot(savedScene)

    if (!snapshot) {
      return false
    }

    set({
      sceneObjects: snapshot.sceneObjects,
      undoStack: [],
      terrainMode: snapshot.terrainMode,
      atmospherePreset: snapshot.atmospherePreset,
      isGridVisible: snapshot.isGridVisible,
      cameraMode: 'build',
      isCameraTransitioning: false,
      selectedObjectId: null,
      placementAssetId: null,
      placementKitId: null,
      activeSceneTemplateId: null,
      activeMemoryPoint: null,
      lastScatterObjectIds: [],
    })

    return true
  },
  autoSaveScene: () => {
    localStorage.setItem(sceneStorageKey, JSON.stringify(createSceneSnapshot(get())))
  },
  clearSavedScene: () => {
    localStorage.removeItem(sceneStorageKey)
  },
  exportScene: () => JSON.stringify(createSceneSnapshot(get()), null, 2),
  importScene: (json) => {
    const snapshot = parseSceneSnapshot(json)

    if (!snapshot) {
      return false
    }

    set({
      sceneObjects: snapshot.sceneObjects,
      undoStack: [],
      terrainMode: snapshot.terrainMode,
      atmospherePreset: snapshot.atmospherePreset,
      isGridVisible: snapshot.isGridVisible,
      cameraMode: 'build',
      isCameraTransitioning: false,
      selectedObjectId: null,
      placementAssetId: null,
      placementKitId: null,
      activeSceneTemplateId: null,
      activeMemoryPoint: null,
      lastScatterObjectIds: [],
    })
    localStorage.setItem(sceneStorageKey, JSON.stringify(snapshot))

    return true
  },
  loadSceneTemplate: (templateId) => {
    const template = sceneTemplates.find((item) => item.id === templateId)

    if (!template) {
      set({ screenshotMessage: 'Scene template could not be found.' })
      return false
    }

    pushUndo()
    const objects = createTemplateObjects(templateId)

    if (objects.length === 0) {
      set({
        screenshotMessage:
          'This template has unavailable assets and was skipped.',
      })
      return false
    }

    set({
      sceneObjects: objects,
      terrainMode: template.terrainMode,
      atmospherePreset: template.atmospherePreset,
      cameraMode: 'build',
      isCameraTransitioning: false,
      selectedObjectId: null,
      placementAssetId: null,
      placementKitId: null,
      activeSceneTemplateId: template.id,
      activeMemoryPoint: null,
      lastScatterObjectIds: [],
      screenshotMessage: 'Template loaded.',
    })

    return true
  },
  openMemoryPoint: (activeMemoryPoint) => set({ activeMemoryPoint }),
  closeMemoryPoint: () => set({ activeMemoryPoint: null }),
  setTerrainMode: (terrainMode) => set({ terrainMode }),
  setAtmospherePreset: (atmospherePreset) => set({ atmospherePreset }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleGrid: () =>
    set((state) => ({ isGridVisible: !state.isGridVisible })),
  toggleAnimalsWalking: () =>
    set((state) => ({ areAnimalsWalking: !state.areAnimalsWalking })),
  updateObjectMotion: (id, position, rotation) =>
    set((state) => ({
      sceneObjects: state.sceneObjects.map((object) =>
        object.id === id
          ? {
              ...object,
              position: [position[0], 0, position[2]],
              rotation,
            }
          : object,
      ),
    })),
  requestScreenshot: () =>
    set((state) => ({
      screenshotRequestId: state.screenshotRequestId + 1,
      screenshotMessage: '',
    })),
  setScreenshotMessage: (message) => set({ screenshotMessage: message }),
  reportModelLoadFailure: (path) => {
    console.error(`Model failed to load: ${path}`)
    set({
      modelLoadWarning:
        'Some models failed to load. Check file path or missing .bin / texture dependencies.',
    })
  },
  setCameraMode: (mode) =>
    set({
      cameraMode: mode,
      placementAssetId: null,
      placementKitId: null,
      selectedObjectId: mode === 'walk' ? null : get().selectedObjectId,
      ...(mode === 'build'
        ? {
            gameMode: 'sandbox' as GameMode,
            gameStartedAt: null,
            gameTimeRemaining: gameDurationSeconds,
            gameTasks: { collectWood: false, repairBridge: false },
            gamePrompt: null,
            gamePromptProgress: 0,
            walkPose: null,
          }
        : {}),
    }),
  setCameraTransitioning: (isTransitioning) =>
    set({ isCameraTransitioning: isTransitioning }),
  }
})
