import { useMemo, useState } from 'react'
import { assets } from '../../data/assets'
import { memoryKitCategories, memoryKits } from '../../data/memoryKits'
import { sceneTemplates } from '../../data/sceneTemplates'
import { useSceneStore } from '../../store/sceneStore'
import type {
  AssetCategory,
  AtmospherePreset,
  MemoryKitCategory,
  TerrainMode,
} from '../../types/scene'
import { AssetCard } from './AssetCard'

const terrainModes: TerrainMode[] = [
  'Riverbank',
  'Village Road',
  'Field Path',
  'Empty Field',
  'Courtyard',
]

const atmospherePresets: AtmospherePreset[] = [
  'Clear Morning',
  'Sunset',
  'Rainy Day',
  'Heavy Rain',
  'Snowy Day',
  'Summer Night',
]

const categoryOrder: AssetCategory[] = [
  'HOUSES',
  'Animals',
  'Trees',
  'Plants',
  'Flowers',
  'Rocks',
  'Paths',
  'Water',
  'Props',
]

export function AssetSidebar() {
  const [searchTerm, setSearchTerm] = useState('')
  const [templateFilterTerm, setTemplateFilterTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<
    Record<AssetCategory, boolean>
  >({
    HOUSES: false,
    Animals: false,
    Trees: false,
    Plants: false,
    Flowers: false,
    Rocks: false,
    Paths: false,
    Water: false,
    Props: false,
  })
  const setPlacementAsset = useSceneStore((state) => state.setPlacementAsset)
  const setPlacementKit = useSceneStore((state) => state.setPlacementKit)
  const loadSceneTemplate = useSceneStore((state) => state.loadSceneTemplate)
  const placementAssetId = useSceneStore((state) => state.placementAssetId)
  const placementKitId = useSceneStore((state) => state.placementKitId)
  const terrainMode = useSceneStore((state) => state.terrainMode)
  const atmospherePreset = useSceneStore((state) => state.atmospherePreset)
  const isMuted = useSceneStore((state) => state.isMuted)
  const setTerrainMode = useSceneStore((state) => state.setTerrainMode)
  const setAtmospherePreset = useSceneStore(
    (state) => state.setAtmospherePreset,
  )
  const toggleMute = useSceneStore((state) => state.toggleMute)
  const activeSceneTemplateId = useSceneStore(
    (state) => state.activeSceneTemplateId,
  )
  const [isSceneTemplatesExpanded, setSceneTemplatesExpanded] = useState(false)
  const [isMemoryKitsExpanded, setMemoryKitsExpanded] = useState(false)
  const [expandedKitCategories, setExpandedKitCategories] = useState<
    Record<MemoryKitCategory, boolean>
  >({
    'Nature Corners': false,
    'Water Corners': false,
    'Path Corners': false,
  })
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const normalizedTemplateFilter = templateFilterTerm.trim().toLowerCase()
  const isSearching = normalizedSearch.length > 0
  const availableAssetIds = useMemo(
    () => new Set(assets.map((asset) => asset.id)),
    [],
  )
  const groupedAssets = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          assets: assets.filter(
            (asset) =>
              asset.category === category &&
              (!normalizedSearch ||
                asset.name.toLowerCase().includes(normalizedSearch) ||
                asset.category.toLowerCase().includes(normalizedSearch)),
          ),
        }))
        .filter((group) => group.assets.length > 0),
    [normalizedSearch],
  )
  const visibleSceneTemplates = useMemo(
    () =>
      sceneTemplates
        .map((template) => ({
          ...template,
          objects: template.objects.filter((object) =>
            availableAssetIds.has(object.assetId),
          ),
        }))
        .filter(
          (template) =>
            template.objects.length > 0 &&
            (!normalizedSearch ||
              template.name.toLowerCase().includes(normalizedSearch) ||
              template.terrainMode.toLowerCase().includes(normalizedSearch) ||
              template.atmospherePreset.toLowerCase().includes(normalizedSearch)) &&
            (!normalizedTemplateFilter ||
              template.name.toLowerCase().includes(normalizedTemplateFilter) ||
              template.type.toLowerCase().includes(normalizedTemplateFilter) ||
              template.season.toLowerCase().includes(normalizedTemplateFilter) ||
              template.atmospherePreset
                .toLowerCase()
                .includes(normalizedTemplateFilter) ||
              template.terrainMode
                .toLowerCase()
                .includes(normalizedTemplateFilter)),
        ),
    [availableAssetIds, normalizedSearch, normalizedTemplateFilter],
  )
  const activeSceneTemplate = sceneTemplates.find(
    (template) => template.id === activeSceneTemplateId,
  )
  const groupedKits = useMemo(
    () =>
      memoryKitCategories
        .map((category) => ({
          category,
          kits: memoryKits
            .map((kit) => ({
              ...kit,
              objects: kit.objects.filter((object) =>
                availableAssetIds.has(object.assetId),
              ),
            }))
            .filter(
              (kit) =>
                kit.category === category &&
                kit.objects.length >= 2 &&
              (!normalizedSearch ||
                kit.name.toLowerCase().includes(normalizedSearch) ||
                kit.category.toLowerCase().includes(normalizedSearch)),
            ),
        }))
        .filter((group) => group.kits.length > 0),
    [availableAssetIds, normalizedSearch],
  )
  const visibleKitCount = groupedKits.reduce(
    (count, group) => count + group.kits.length,
    0,
  )

  const toggleCategory = (category: AssetCategory) => {
    setExpandedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  const toggleKitCategory = (category: MemoryKitCategory) => {
    setExpandedKitCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  const setAllPanelsExpanded = (isExpanded: boolean) => {
    setSceneTemplatesExpanded(isExpanded)
    setMemoryKitsExpanded(isExpanded)
    setExpandedCategories(
      categoryOrder.reduce(
        (nextCategories, category) => ({
          ...nextCategories,
          [category]: isExpanded,
        }),
        {} as Record<AssetCategory, boolean>,
      ),
    )
    setExpandedKitCategories(
      memoryKitCategories.reduce(
        (nextCategories, category) => ({
          ...nextCategories,
          [category]: isExpanded,
        }),
        {} as Record<MemoryKitCategory, boolean>,
      ),
    )
  }

  const handleTemplateClick = (templateId: string) => {
    loadSceneTemplate(templateId)
  }

  return (
    <aside className="asset-sidebar" aria-label="Asset library">
      <div className="sidebar-header asset-sidebar-sticky">
        <section className="world-settings" aria-labelledby="world-settings-title">
          <div className="world-settings-heading">
            <span className="step-number">1</span>
            <div>
              <strong id="world-settings-title">Set your world</strong>
              <small>Choose the place and mood.</small>
            </div>
          </div>
          <label className="world-setting-control">
            <span>Terrain</span>
            <select
              value={terrainMode}
              onChange={(event) =>
                setTerrainMode(event.target.value as TerrainMode)
              }
            >
              {terrainModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="world-setting-control">
            <span>Weather</span>
            <select
              value={atmospherePreset}
              onChange={(event) =>
                setAtmospherePreset(event.target.value as AtmospherePreset)
              }
            >
              {atmospherePresets.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>
          <button
            className="world-sound-toggle"
            type="button"
            onClick={toggleMute}
          >
            {isMuted ? 'Unmute sound' : 'Mute sound'}
          </button>
        </section>

        <h2><span className="step-number">2</span> Place your memories</h2>
        <p>
          {placementAssetId
            ? 'Click the ground to place'
            : placementKitId
            ? 'Click the ground to place'
            : 'Pick an asset, then click the ground to place it'}
        </p>
        <input
          className="asset-search"
          type="search"
          placeholder="Search assets"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <div className="sidebar-actions" aria-label="Asset panel controls">
          <button type="button" onClick={() => setAllPanelsExpanded(true)}>
            Expand all
          </button>
          <button type="button" onClick={() => setAllPanelsExpanded(false)}>
            Collapse all
          </button>
        </div>
      </div>
      {assets.length > 0 ? (
        <div className="asset-list">
          <section className="memory-kits">
            <button
              type="button"
              className="asset-group-header memory-kits-header"
              onClick={() =>
                setSceneTemplatesExpanded((current) => !current)
              }
            >
              <span className="chevron" aria-hidden="true">{isSceneTemplatesExpanded ? '▾' : '▸'}</span>
              <span>
                Scene Templates ({visibleSceneTemplates.length})
                {activeSceneTemplate ? (
                  <small className="active-template-name">
                    Active: {activeSceneTemplate.name}
                  </small>
                ) : null}
              </span>
            </button>
            {activeSceneTemplate && !isSceneTemplatesExpanded ? (
              <div className="active-template-strip">
                <span>{activeSceneTemplate.name}</span>
                <button
                  type="button"
                  onClick={() => loadSceneTemplate(activeSceneTemplate.id)}
                >
                  Reset Template
                </button>
              </div>
            ) : null}
            {isSceneTemplatesExpanded ? (
              <div className="scene-template-panel">
                <input
                  className="template-filter"
                  type="search"
                  placeholder="Filter templates by season or type"
                  value={templateFilterTerm}
                  onChange={(event) => setTemplateFilterTerm(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                />
                {activeSceneTemplate ? (
                  <button
                    type="button"
                    className="reset-template-button"
                    onClick={() => loadSceneTemplate(activeSceneTemplate.id)}
                  >
                    Reset Template
                  </button>
                ) : null}
                <div className="scene-template-list">
                  {visibleSceneTemplates.map((template) => {
                    const isActive = activeSceneTemplateId === template.id

                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`scene-template-card${
                          isActive ? ' is-active' : ''
                        }`}
                        onClick={() => handleTemplateClick(template.id)}
                      >
                        <span
                          className={`scene-template-thumb is-${template.thumbnail}`}
                          aria-hidden="true"
                        >
                          <span />
                          <span />
                          <span />
                        </span>
                        <span className="scene-template-copy">
                          <span>
                            {template.name}
                            {isActive ? (
                              <strong aria-label="active template">
                                Active
                              </strong>
                            ) : null}
                          </span>
                          <small>
                            {template.type} / {template.season}
                          </small>
                          <span className="scene-template-details">
                            {template.terrainMode} |{' '}
                            {template.atmospherePreset} |{' '}
                            {template.objects.length} objects
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </section>
          <section className="memory-kits">
            <button
              type="button"
              className="asset-group-header memory-kits-header"
              onClick={() => setMemoryKitsExpanded((current) => !current)}
            >
              <span className="chevron" aria-hidden="true">{isMemoryKitsExpanded ? '▾' : '▸'}</span>
              <span>MEMORY KITS ({visibleKitCount})</span>
            </button>
            {isMemoryKitsExpanded ? (
              <div className="asset-group-list">
                {groupedKits.map((group) => (
                  <section key={group.category} className="asset-group">
                    <button
                      type="button"
                      className="asset-group-header kit-group-header"
                      onClick={() => toggleKitCategory(group.category)}
                    >
                      <span className="chevron" aria-hidden="true">
                        {isSearching || expandedKitCategories[group.category]
                          ? '▾'
                          : '▸'}
                      </span>
                      <span>
                        {group.category} ({group.kits.length})
                      </span>
                    </button>
                    {isSearching || expandedKitCategories[group.category] ? (
                      <div className="asset-group-list">
                        {group.kits.map((kit) => (
                          <button
                            key={kit.id}
                            type="button"
                            className={`asset-card memory-kit-card${
                              placementKitId === kit.id ? ' is-active' : ''
                            }`}
                            onClick={() => setPlacementKit(kit.id)}
                          >
                            <span className="asset-color" aria-hidden="true" />
                            <span>{kit.name}</span>
                            <small>{kit.objects.length} items</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : null}
          </section>
          {groupedAssets.map((group) => (
            <section key={group.category} className="asset-group">
              <button
                type="button"
                className="asset-group-header"
                onClick={() => toggleCategory(group.category)}
              >
                <span className="chevron" aria-hidden="true">
                  {isSearching || expandedCategories[group.category]
                    ? '▾'
                    : '▸'}
                </span>
                <span>
                  {group.category} ({group.assets.length})
                </span>
              </button>
              {isSearching || expandedCategories[group.category] ? (
                <div className="asset-group-list">
                  {group.assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isActive={placementAssetId === asset.id}
                      showCategory={isSearching}
                      onClick={setPlacementAsset}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ))}
          {groupedAssets.length === 0 &&
          groupedKits.length === 0 &&
          visibleSceneTemplates.length === 0 ? (
            <div className="empty-state">
              <p>No matching assets.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <p>No assets loaded yet.</p>
        </div>
      )}
    </aside>
  )
}
