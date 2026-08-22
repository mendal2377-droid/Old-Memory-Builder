import type { SceneTemplateDefinition } from '../types/scene'
import { assets } from './assets'

type TemplateJsonObject = {
  assetId?: unknown
  position?: unknown
  rotation?: unknown
  scale?: unknown
}

type TemplateJson = {
  id?: unknown
  name?: unknown
  terrain?: unknown
  terrainMode?: unknown
  atmosphere?: unknown
  atmospherePreset?: unknown
  objects?: unknown
  sceneObjects?: unknown
}

const trustedTemplateIds = [
  'village_dusk',
  'lakeside_night',
  'snowbound_hamlet',
  'forest_explore_summer',
  'riverbank_morning',
  'flower_garden_autumn',
] as const

const templateDisplayOrder = new Map(
  trustedTemplateIds.map((templateId, index) => [templateId, index]),
)

const templateNames: Record<(typeof trustedTemplateIds)[number], string> = {
  village_dusk: 'Village at Dusk',
  lakeside_night: 'Lakeside Summer Night',
  snowbound_hamlet: 'Snowbound Hamlet',
  flower_garden_autumn: 'Flower Garden in Autumn',
  forest_explore_summer: 'Forest Explore in Summer',
  riverbank_morning: 'Quiet Riverbank Morning',
}

const availableAssetIds = new Set(assets.map((asset) => asset.id))

function isVector3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number')
  )
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeTerrain(value: unknown): SceneTemplateDefinition['terrainMode'] {
  if (value === 'Field Path' || value === 'fieldPath') {
    return 'Field Path'
  }

  if (value === 'Riverbank' || value === 'riverbank') {
    return 'Riverbank'
  }

  if (value === 'Village Road' || value === 'villageRoad') {
    return 'Village Road'
  }

  if (value === 'Courtyard' || value === 'courtyard') {
    return 'Courtyard'
  }

  return 'Empty Field'
}

function normalizeAtmosphere(
  value: unknown,
): SceneTemplateDefinition['atmospherePreset'] {
  if (value === 'Sunset' || value === 'sunset' || value === 'Golden Afternoon') {
    return 'Sunset'
  }

  if (value === 'Rainy Day' || value === 'rainyDay') {
    return 'Rainy Day'
  }

  if (value === 'Heavy Rain' || value === 'heavyRain') {
    return 'Heavy Rain'
  }

  if (value === 'Snowy Day' || value === 'snowyDay') {
    return 'Snowy Day'
  }

  if (value === 'Summer Night' || value === 'summerNight') {
    return 'Summer Night'
  }

  return 'Clear Morning'
}

function inferTemplateMeta(id: string): Pick<
  SceneTemplateDefinition,
  'type' | 'season' | 'thumbnail' | 'description'
> {
  if (id.includes('village')) {
    return {
      type: 'Custom',
      season: 'Any',
      thumbnail: 'river',
      description:
        'A riverside village at dusk — cabins, a barn, a watermill, a bridge, and a lighthouse across the water.',
    }
  }

  if (id.includes('night')) {
    return {
      type: 'Riverbank',
      season: 'Summer',
      thumbnail: 'river',
      description:
        'A calm summer night by the water. The lighthouse lamp glows beneath a sky full of drifting stars.',
    }
  }

  if (id.includes('snow') || id.includes('hamlet')) {
    return {
      type: 'Custom',
      season: 'Winter',
      thumbnail: 'forest',
      description:
        'A quiet snowbound hamlet ringed by pines, with a frozen river crossing and falling snow.',
    }
  }

  if (id.includes('forest')) {
    return {
      type: 'Forest',
      season: 'Summer',
      thumbnail: 'forest',
      description: 'A dense but walkable summer forest path with trees, rocks, grasses, and animals.',
    }
  }

  if (id.includes('river')) {
    return {
      type: 'Riverbank',
      season: 'Summer',
      thumbnail: 'river',
      description: 'A calm riverbank morning with flowing water, stones, reeds, and open grass.',
    }
  }

  if (id.includes('autumn') || id.includes('garden')) {
    return {
      type: 'Garden',
      season: 'Autumn',
      thumbnail: 'autumn',
      description: 'A warm autumn flower garden with a guided stone path and layered color.',
    }
  }

  return {
    type: 'Custom',
    season: 'Any',
    thumbnail: 'forest',
    description: 'A custom scene template loaded from the templates folder.',
  }
}

function normalizeTemplateObject(
  object: TemplateJsonObject,
): SceneTemplateDefinition['objects'][number] | null {
  if (
    typeof object.assetId !== 'string' ||
    !availableAssetIds.has(object.assetId) ||
    !isVector3(object.position)
  ) {
    return null
  }

  return {
    assetId: object.assetId,
    position: object.position,
    rotation: isVector3(object.rotation) ? object.rotation : [0, 0, 0],
    scale: isVector3(object.scale) ? object.scale : [1, 1, 1],
  }
}

const publicTemplateModules = import.meta.glob<TemplateJson>(
  '/public/assets/templates/*.json',
  {
    eager: true,
    import: 'default',
  },
)

function createTemplateFromJson(
  modulePath: string,
  templateJson: TemplateJson,
): SceneTemplateDefinition | null {
  const fileName = modulePath.split('/').pop()?.replace('.json', '') ?? ''
  const id =
    typeof templateJson.id === 'string' && templateJson.id.length > 0
      ? templateJson.id
      : fileName

  if (
    !trustedTemplateIds.includes(
      fileName as (typeof trustedTemplateIds)[number],
    ) ||
    id !== fileName
  ) {
    return null
  }

  const rawObjects = Array.isArray(templateJson.sceneObjects)
    ? templateJson.sceneObjects
    : templateJson.objects

  const objects = Array.isArray(rawObjects)
    ? rawObjects
        .map((object) => normalizeTemplateObject(object as TemplateJsonObject))
        .filter((object): object is NonNullable<typeof object> => object !== null)
    : []

  if (objects.length === 0) {
    return null
  }

  const meta = inferTemplateMeta(id)

  return {
    id,
    name:
      id in templateNames
        ? templateNames[id as keyof typeof templateNames]
        : typeof templateJson.name === 'string' && templateJson.name.length > 0
          ? templateJson.name
          : toTitleCase(id),
    jsonPath: `/assets/templates/${fileName}.json`,
    ...meta,
    terrainMode: normalizeTerrain(templateJson.terrainMode ?? templateJson.terrain),
    atmospherePreset: normalizeAtmosphere(
      templateJson.atmospherePreset ?? templateJson.atmosphere,
    ),
    objects,
  }
}

export const sceneTemplates: SceneTemplateDefinition[] = Object.entries(
  publicTemplateModules,
)
  .map(([modulePath, templateJson]) =>
    createTemplateFromJson(modulePath, templateJson),
  )
  .filter((template): template is SceneTemplateDefinition => template !== null)
  .sort(
    (first, second) =>
      (templateDisplayOrder.get(first.id as (typeof trustedTemplateIds)[number]) ??
        99) -
      (templateDisplayOrder.get(second.id as (typeof trustedTemplateIds)[number]) ??
        99),
  )
