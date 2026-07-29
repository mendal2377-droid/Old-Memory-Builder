import type { MemoryKitCategory, MemoryKitDefinition } from '../types/scene'

export const memoryKitCategories: MemoryKitCategory[] = [
  'Nature Corners',
  'Water Corners',
  'Path Corners',
]

export const memoryKits: MemoryKitDefinition[] = [
  {
    id: 'kit_riverside_tree_corner',
    name: 'Riverside Tree Corner',
    category: 'Nature Corners',
    objects: [
      {
        assetId: 'commontree_2',
        position: [-1.6, 0, -0.9],
        rotation: [0, 0.45, 0],
        scale: [1.35, 1.35, 1.35],
      },
      {
        assetId: 'pine_2',
        position: [1.4, 0, -1.5],
        rotation: [0, -0.25, 0],
        scale: [1.15, 1.15, 1.15],
      },
      {
        assetId: 'rock_medium_1',
        position: [-2.3, 0, 1.3],
        rotation: [0, 0.25, 0],
        scale: [0.9, 0.9, 0.9],
      },
      {
        assetId: 'rock_medium_2',
        position: [1.9, 0, 1.1],
        rotation: [0, -0.45, 0],
        scale: [0.75, 0.75, 0.75],
      },
      {
        assetId: 'grass_common_tall',
        position: [-0.4, 0, 1.4],
        rotation: [0, 0.1, 0],
        scale: [1.2, 1.2, 1.2],
      },
      {
        assetId: 'fern_1',
        position: [0.7, 0, 0.8],
        rotation: [0, -0.35, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'flower_3_group',
        position: [-1.3, 0, 1.9],
        rotation: [0, 0.25, 0],
        scale: [0.85, 0.85, 0.85],
      },
      {
        assetId: 'flower_4_single',
        position: [1.2, 0, 1.8],
        rotation: [0, -0.2, 0],
        scale: [1.1, 1.1, 1.1],
      },
    ],
  },
  {
    id: 'kit_flower_meadow_patch',
    name: 'Flower Meadow Patch',
    category: 'Nature Corners',
    objects: [
      {
        assetId: 'flower_3_group',
        position: [-1.6, 0, -0.8],
        rotation: [0, 0.2, 0],
        scale: [1.05, 1.05, 1.05],
      },
      {
        assetId: 'flower_4_group',
        position: [0.8, 0, -0.9],
        rotation: [0, -0.35, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'flower_3_single',
        position: [-0.3, 0, 0.6],
        rotation: [0, 0.1, 0],
        scale: [1.2, 1.2, 1.2],
      },
      {
        assetId: 'flower_4_single',
        position: [1.7, 0, 0.9],
        rotation: [0, -0.15, 0],
        scale: [1.15, 1.15, 1.15],
      },
      {
        assetId: 'clover_1',
        position: [-1, 0, 1],
        rotation: [0, 0.4, 0],
        scale: [1.1, 1.1, 1.1],
      },
      {
        assetId: 'grass_common_short',
        position: [0.3, 0, 1.5],
        rotation: [0, -0.2, 0],
        scale: [1.15, 1.15, 1.15],
      },
      {
        assetId: 'pebble_round_2',
        position: [2, 0, -0.2],
        rotation: [0, 0.25, 0],
        scale: [0.7, 0.7, 0.7],
      },
      {
        assetId: 'pebble_square_1',
        position: [-2.1, 0, 0.4],
        rotation: [0, -0.25, 0],
        scale: [0.65, 0.65, 0.65],
      },
    ],
  },
  {
    id: 'kit_forest_entrance',
    name: 'Forest Entrance',
    category: 'Nature Corners',
    objects: [
      {
        assetId: 'pine_4',
        position: [-2, 0, -1.4],
        rotation: [0, 0.25, 0],
        scale: [1.3, 1.3, 1.3],
      },
      {
        assetId: 'pine_5',
        position: [2, 0, -1.2],
        rotation: [0, -0.3, 0],
        scale: [1.25, 1.25, 1.25],
      },
      {
        assetId: 'commontree_3',
        position: [-1.1, 0, 1.2],
        rotation: [0, -0.15, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'twistedtree_2',
        position: [1.4, 0, 1.1],
        rotation: [0, 0.35, 0],
        scale: [0.9, 0.9, 0.9],
      },
      {
        assetId: 'grass_wispy_tall',
        position: [0, 0, 1.8],
        rotation: [0, 0.2, 0],
        scale: [1.15, 1.15, 1.15],
      },
      {
        assetId: 'rock_medium_3',
        position: [-2.4, 0, 0.6],
        rotation: [0, -0.45, 0],
        scale: [0.85, 0.85, 0.85],
      },
      {
        assetId: 'pebble_round_4',
        position: [2.2, 0, 0.7],
        rotation: [0, 0.4, 0],
        scale: [0.7, 0.7, 0.7],
      },
    ],
  },
  {
    id: 'kit_quiet_pond_corner',
    name: 'Quiet Pond Corner',
    category: 'Water Corners',
    objects: [
      {
        assetId: 'water_pond_medium',
        position: [0, 0, 0],
        rotation: [0, 0.25, 0],
        scale: [1.2, 1, 0.9],
      },
      {
        assetId: 'rock_medium_1',
        position: [-1.8, 0, -0.9],
        rotation: [0, 0.35, 0],
        scale: [0.75, 0.75, 0.75],
      },
      {
        assetId: 'rock_medium_2',
        position: [1.7, 0, 0.9],
        rotation: [0, -0.25, 0],
        scale: [0.7, 0.7, 0.7],
      },
      {
        assetId: 'pebble_round_1',
        position: [-0.7, 0, 1.5],
        rotation: [0, 0.2, 0],
        scale: [0.65, 0.65, 0.65],
      },
      {
        assetId: 'fern_1',
        position: [1.6, 0, -1.1],
        rotation: [0, -0.45, 0],
        scale: [0.95, 0.95, 0.95],
      },
      {
        assetId: 'grass_common_tall',
        position: [-1.4, 0, 1.2],
        rotation: [0, 0.3, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'flower_4_group',
        position: [0.9, 0, 1.8],
        rotation: [0, -0.2, 0],
        scale: [0.9, 0.9, 0.9],
      },
    ],
  },
  {
    id: 'kit_stone_path_corner',
    name: 'Stone Path Corner',
    category: 'Path Corners',
    objects: [
      {
        assetId: 'rockpath_round_wide',
        position: [-1.6, 0, -0.7],
        rotation: [0, 0.15, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'rockpath_round_small_1',
        position: [-0.4, 0, -0.1],
        rotation: [0, -0.25, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'rockpath_round_small_2',
        position: [0.7, 0, 0.5],
        rotation: [0, 0.35, 0],
        scale: [0.95, 0.95, 0.95],
      },
      {
        assetId: 'rockpath_round_thin',
        position: [1.7, 0, 1],
        rotation: [0, -0.1, 0],
        scale: [0.95, 1, 0.95],
      },
      {
        assetId: 'rock_medium_1',
        position: [-2.2, 0, 0.8],
        rotation: [0, -0.4, 0],
        scale: [0.75, 0.75, 0.75],
      },
      {
        assetId: 'pebble_square_3',
        position: [2.2, 0, -0.4],
        rotation: [0, 0.35, 0],
        scale: [0.7, 0.7, 0.7],
      },
      {
        assetId: 'grass_wispy_short',
        position: [-1.1, 0, 1.5],
        rotation: [0, 0.2, 0],
        scale: [1, 1, 1],
      },
      {
        assetId: 'flower_3_single',
        position: [1.3, 0, -1.1],
        rotation: [0, -0.25, 0],
        scale: [1.1, 1.1, 1.1],
      },
    ],
  },
]
