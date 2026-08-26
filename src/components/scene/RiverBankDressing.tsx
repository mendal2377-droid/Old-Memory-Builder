import { useMemo } from 'react'
import { DoubleSide } from 'three'

/**
 * Stones and reeds bedded into the riverbank.
 *
 * The water reads correctly now, but it still met the grass along a clean
 * line, which is what made the banks look cut rather than worn. These sit in
 * the margin on both sides — stone below, reeds above — so the edge has
 * something to blur it.
 */

/** Same blobs the water, the grass and the walk collision all use. */
const riverBlobs: Array<[number, number, number, number]> = [
  [13, -22, 4.2, 5.2],
  [12, -15, 4.4, 5.4],
  [13, -8, 4.2, 5.2],
  [16, -1, 4.6, 5.8],
  [18, 6, 4.3, 5.4],
  [17, 13, 4.4, 5.6],
  [15, 20, 4, 5],
]

function hash(i: number, salt: number) {
  const n = Math.sin(i * 41.317 + salt * 289.71) * 27183.845
  return n - Math.floor(n)
}

interface Bit {
  x: number
  z: number
  s: number
  rot: number
  kind: 'stone' | 'reed'
}

export function RiverBankDressing() {
  const bits = useMemo(() => {
    const out: Bit[] = []
    riverBlobs.forEach(([cx, cz, w, l], bi) => {
      const per = 13
      for (let i = 0; i < per; i += 1) {
        const k = bi * 97 + i
        const a = hash(k, 1) * Math.PI * 2
        // Sit in the margin: just outside the waterline, not out in the field
        const t = 0.94 + hash(k, 2) * 0.26
        const x = cx + Math.cos(a) * w * t
        const z = cz + Math.sin(a) * l * t
        const reed = hash(k, 3) > 0.45
        out.push({
          x,
          z,
          s: 0.55 + hash(k, 4) * 0.7,
          rot: hash(k, 5) * Math.PI * 2,
          kind: reed ? 'reed' : 'stone',
        })
      }
    })
    return out
  }, [])

  return (
    <group>
      {bits.map((b, i) =>
        b.kind === 'stone' ? (
          <mesh
            key={`bank-${i}`}
            position={[b.x, 0.06 * b.s, b.z]}
            rotation={[hash(i, 7) * 0.5, b.rot, hash(i, 8) * 0.4]}
            castShadow
            receiveShadow
            raycast={() => null}
          >
            <dodecahedronGeometry args={[0.26 * b.s, 0]} />
            <meshStandardMaterial color="#82837f" roughness={1} flatShading />
          </mesh>
        ) : (
          <group key={`bank-${i}`} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
            {[0, 1, 2].map((r) => (
              <mesh
                key={`reed-${r}`}
                position={[(r - 1) * 0.09 * b.s, 0.34 * b.s, (r % 2) * 0.07 * b.s]}
                rotation={[(r - 1) * 0.14, 0, (r - 1) * 0.1]}
                raycast={() => null}
              >
                <planeGeometry args={[0.055 * b.s, 0.78 * b.s]} />
                <meshStandardMaterial
                  color={r === 1 ? '#6f9a52' : '#5d8747'}
                  roughness={1}
                  side={DoubleSide}
                />
              </mesh>
            ))}
          </group>
        ),
      )}
    </group>
  )
}
