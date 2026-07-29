import type { AssetCategory, AssetDefinition } from '../../types/scene'

const categoryColors: Record<AssetCategory, string> = {
  HOUSES: '#c4856a',
  Animals: '#d4a862',
  Trees: '#6aab68',
  Plants: '#8dc97a',
  Flowers: '#d46896',
  Rocks: '#9a9080',
  Paths: '#c4a87a',
  Water: '#6aaed4',
  Props: '#8a7ab8',
}

const categoryIcons: Record<AssetCategory, string> = {
  HOUSES: '🏠',
  Animals: '🐦',
  Trees: '🌲',
  Plants: '🌿',
  Flowers: '🌸',
  Rocks: '🪨',
  Paths: '🪵',
  Water: '💧',
  Props: '🏮',
}

interface AssetCardProps {
  asset: AssetDefinition
  isActive?: boolean
  showCategory?: boolean
  onClick: (assetId: string) => void
}

export function AssetCard({ asset, isActive = false, showCategory = false, onClick }: AssetCardProps) {
  return (
    <button
      type="button"
      className={`asset-card${isActive ? ' is-active' : ''}`}
      onClick={() => onClick(asset.id)}
    >
      <span
        className="asset-color"
        aria-hidden="true"
        style={{ background: categoryColors[asset.category] }}
      />
      <span className="asset-card-label">
        <span className="asset-card-name">{asset.name}</span>
        {showCategory ? (
          <span className="asset-card-category">
            {categoryIcons[asset.category]} {asset.category}
          </span>
        ) : null}
      </span>
    </button>
  )
}
