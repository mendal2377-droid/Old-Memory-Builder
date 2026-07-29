import type { AssetCategory, AssetDefinition, ModelPath } from '../types/scene'

const defaultScale: [number, number, number] = [1, 1, 1]
const defaultRotation: [number, number, number] = [0, 0, 0]
const idOverrides: Record<string, string> = {
  Deer: 'deer_01',
  Fox: 'fox_01',
  Wolf: 'wolf_01',
}

function toDisplayName(fileName: string) {
  return fileName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function createAsset(fileName: string, category: AssetCategory): AssetDefinition {
  return {
    id: idOverrides[fileName] ?? fileName.replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
    name: toDisplayName(fileName),
    category,
    kind: 'model',
    path: `/assets/models/ready/${fileName}.gltf` as ModelPath,
    defaultScale,
    defaultRotation,
    yOffset: 0,
  }
}

function createWaterAsset(
  id: string,
  name: string,
  defaultScale: [number, number, number],
): AssetDefinition {
  return {
    id,
    name,
    category: 'Water',
    kind: 'water',
    defaultScale,
    defaultRotation,
    yOffset: 0.03,
  }
}

function createCabinAsset(
  id: string,
  name: string,
  defaultScale: [number, number, number] = [1, 1, 1],
): AssetDefinition {
  return {
    id,
    name,
    category: 'HOUSES',
    kind: 'cabin',
    defaultScale,
    defaultRotation,
    yOffset: 0,
    collisionRadius: 1.4,
  }
}

function createBarnAsset(id: string, name: string, defaultScale: [number, number, number] = [1, 1, 1]): AssetDefinition {
  return { id, name, category: 'HOUSES', kind: 'barn', defaultScale, defaultRotation, yOffset: 0, collisionRadius: 1.9 }
}

function createMillAsset(id: string, name: string, defaultScale: [number, number, number] = [1, 1, 1]): AssetDefinition {
  return { id, name, category: 'HOUSES', kind: 'mill', defaultScale, defaultRotation, yOffset: 0, collisionRadius: 1.6 }
}

function createBridgeAsset(id: string, name: string, defaultScale: [number, number, number] = [1, 1, 1]): AssetDefinition {
  return { id, name, category: 'Props', kind: 'bridge', defaultScale, defaultRotation, yOffset: 0, collisionRadius: 0 }
}

function createLighthouseAsset(id: string, name: string, defaultScale: [number, number, number] = [1, 1, 1]): AssetDefinition {
  return { id, name, category: 'HOUSES', kind: 'lighthouse', defaultScale, defaultRotation, yOffset: 0, collisionRadius: 1.1 }
}

function createWoodpileAsset(id: string, name: string, defaultScale: [number, number, number] = [1, 1, 1]): AssetDefinition {
  return { id, name, category: 'Props', kind: 'woodpile', defaultScale, defaultRotation, yOffset: 0, collisionRadius: 0.6 }
}

const animalAssets = [
  'Alpaca',
  'Bull',
  'Cow',
  'Deer',
  'Donkey',
  'Fox',
  'Horse',
  'Horse_White',
  'Husky',
  'ShibaInu',
  'Stag',
  'Wolf',
]

const treeAssets = [
  'CommonTree_1',
  'CommonTree_2',
  'CommonTree_3',
  'CommonTree_4',
  'CommonTree_5',
  'DeadTree_1',
  'DeadTree_2',
  'DeadTree_3',
  'DeadTree_4',
  'DeadTree_5',
  'Pine_1',
  'Pine_2',
  'Pine_3',
  'Pine_4',
  'Pine_5',
  'TwistedTree_1',
  'TwistedTree_2',
  'TwistedTree_3',
  'TwistedTree_4',
  'TwistedTree_5',
]

const plantAssets = [
  'Bush_Common',
  'Bush_Common_Flowers',
  'Clover_1',
  'Clover_2',
  'Fern_1',
  'Grass_Common_Short',
  'Grass_Common_Tall',
  'Grass_Wispy_Short',
  'Grass_Wispy_Tall',
  'Mushroom_Common',
  'Mushroom_Laetiporus',
  'Plant_1',
  'Plant_1_Big',
  'Plant_7',
  'Plant_7_Big',
]

const flowerAssets = [
  'Flower_3_Group',
  'Flower_3_Single',
  'Flower_4_Group',
  'Flower_4_Single',
  'Petal_1',
  'Petal_2',
  'Petal_3',
  'Petal_4',
  'Petal_5',
]

const rockAssets = [
  'Pebble_Round_1',
  'Pebble_Round_2',
  'Pebble_Round_3',
  'Pebble_Round_4',
  'Pebble_Round_5',
  'Pebble_Square_1',
  'Pebble_Square_2',
  'Pebble_Square_3',
  'Pebble_Square_4',
  'Pebble_Square_5',
  'Pebble_Square_6',
  'Rock_Medium_1',
  'Rock_Medium_2',
  'Rock_Medium_3',
]

const pathAssets = [
  'RockPath_Round_Small_1',
  'RockPath_Round_Small_2',
  'RockPath_Round_Small_3',
  'RockPath_Round_Thin',
  'RockPath_Round_Wide',
  'RockPath_Square_Small_1',
  'RockPath_Square_Small_2',
  'RockPath_Square_Small_3',
  'RockPath_Square_Thin',
  'RockPath_Square_Wide',
]

export const assets: AssetDefinition[] = [
  createCabinAsset('cabin_01', 'Wooden Cabin', [1.55, 1.55, 1.55]),
  createCabinAsset('cabin_02', 'Tall Cabin', [1.5, 1.85, 1.5]),
  createCabinAsset('cabin_03', 'Wide Cabin', [1.85, 1.45, 1.65]),
  createCabinAsset('cabin_04', 'Small Cabin', [1.3, 1.3, 1.3]),
  createCabinAsset('cabin_05', 'Two-Story House', [1.6, 1.6, 1.6]),
  createBarnAsset('barn_01', 'Red Barn', [1.4, 1.4, 1.4]),
  createMillAsset('mill_01', 'Watermill', [1.4, 1.4, 1.4]),
  createBridgeAsset('bridge_01', 'Wooden Bridge', [1.85, 1.1, 1.15]),
  createLighthouseAsset('lighthouse_01', 'Lighthouse', [1.2, 1.2, 1.2]),
  createWoodpileAsset('woodpile_01', 'Woodpile', [1, 1, 1]),
  ...animalAssets.map((fileName) => createAsset(fileName, 'Animals')),
  ...treeAssets.map((fileName) => createAsset(fileName, 'Trees')),
  ...plantAssets.map((fileName) => createAsset(fileName, 'Plants')),
  ...flowerAssets.map((fileName) => createAsset(fileName, 'Flowers')),
  ...rockAssets.map((fileName) => createAsset(fileName, 'Rocks')),
  ...pathAssets.map((fileName) => createAsset(fileName, 'Paths')),
  createWaterAsset('water_pond_small', 'Small Pond', [1.8, 1, 1.3]),
  createWaterAsset('water_pond_medium', 'Medium Pond', [3.2, 1, 2.2]),
  createWaterAsset('water_river_straight', 'River Segment Straight', [
    4.2,
    1,
    1.1,
  ]),
  createWaterAsset('water_river_curve', 'River Segment Curve', [3.4, 1, 2.2]),
]
