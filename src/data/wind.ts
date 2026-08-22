import { Vector2, type Material } from 'three'
import type { WeatherKind } from './atmosphere'

/**
 * One shared wind for the whole scene. Foliage vertex-sway, rain slant and
 * snow drift all read the same uniforms, so a gust moves everything together.
 *
 * The uniform objects are shared by reference across every patched material,
 * so updating `.value` once per frame updates all of them.
 */
export const windUniforms = {
  uTime: { value: 0 },
  /** Unit direction on the ground plane (x, z). */
  uWindDir: { value: new Vector2(1, 0) },
  /** 0 = still, 1 = gale. Includes the gust envelope. */
  uWindStrength: { value: 0.18 },
}

/** Baseline wind each weather brings, before intensity scaling. */
const weatherWind: Record<WeatherKind, number> = {
  clear: 0.16,
  overcast: 0.34,
  rain: 0.5,
  storm: 1,
  snow: 0.28,
}

/** Categories whose meshes bend in the wind. */
export const swayCategories = new Set(['Trees', 'Plants', 'Flowers'])

const scratch = new Vector2()

/** Current wind as a ground-plane vector scaled by strength. */
export function getWindVector(target: Vector2 = scratch): Vector2 {
  return target
    .copy(windUniforms.uWindDir.value)
    .multiplyScalar(windUniforms.uWindStrength.value)
}

/**
 * Advance the shared wind. Direction drifts slowly so gusts never feel canned;
 * strength is the weather baseline modulated by a two-rate gust envelope.
 */
export function updateWind(
  elapsed: number,
  weather: WeatherKind,
  intensity: number,
) {
  windUniforms.uTime.value = elapsed

  // Slow directional drift, plus a faster wobble during rough weather
  const base = weatherWind[weather] * Math.max(0.15, Math.min(1, intensity || 1))
  const angle =
    elapsed * 0.045 + Math.sin(elapsed * 0.11) * 0.35 + (weather === 'storm' ? 2.4 : 0)
  windUniforms.uWindDir.value.set(Math.cos(angle), Math.sin(angle))

  // Two gust rates so the air breathes instead of pulsing evenly
  const gust =
    0.72 + Math.sin(elapsed * 0.37) * 0.2 + Math.sin(elapsed * 0.93 + 1.1) * 0.12
  windUniforms.uWindStrength.value = Math.max(0.04, base * gust)
}

/**
 * Bend a foliage material in the shared wind. The offset is built in world
 * space so every plant leans the same way, then rotated back into the mesh's
 * local space (assumes uniform scale, which all our assets use).
 *
 * Displacement scales with height above the object's base, so trunks stay
 * planted while canopies swing.
 */
const patchedForWind = new WeakSet<Material>()

export function applyWindSway(material: Material, swayHeight: number) {
  if (patchedForWind.has(material)) {
    return
  }
  patchedForWind.add(material)

  material.onBeforeCompile = (shader) => {
    // Share the global uniform objects by reference; height is per-asset.
    shader.uniforms.uTime = windUniforms.uTime
    shader.uniforms.uWindDir = windUniforms.uWindDir
    shader.uniforms.uWindStrength = windUniforms.uWindStrength
    shader.uniforms.uSwayHeight = { value: Math.max(swayHeight, 0.2) }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindStrength;
      uniform float uSwayHeight;`,
    )

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      {
        vec3 windWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float windH = clamp(max(transformed.y, 0.0) / uSwayHeight, 0.0, 1.0);
        // Quadratic falloff: rigid at the base, loose at the tips
        float windK = windH * windH;
        float windPhase = uTime * 1.35
          + windWorldPos.x * 0.32
          + windWorldPos.z * 0.26;
        float windGust = sin(windPhase) * 0.65
          + sin(windPhase * 2.7 + 1.3) * 0.35;
        vec3 windOffset = vec3(uWindDir.x, 0.0, uWindDir.y)
          * (windK * uWindStrength * windGust * 0.6);
        // Rotate the world-space offset back into local space
        mat3 windM = mat3(modelMatrix);
        float windScale = max(length(windM[0]), 1e-4);
        vec3 windLocal = vec3(
          dot(windM[0], windOffset),
          dot(windM[1], windOffset),
          dot(windM[2], windOffset)
        ) / (windScale * windScale);
        transformed += windLocal;
      }`,
    )
  }

  // Force a distinct program so the un-swayed variant isn't reused
  material.customProgramCacheKey = () => 'wind-sway'
  material.needsUpdate = true
}
