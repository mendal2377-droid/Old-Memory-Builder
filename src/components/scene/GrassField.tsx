import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type InstancedMesh,
} from 'three'
import { windUniforms } from '../../data/wind'
import { useSceneStore } from '../../store/sceneStore'
import type { TerrainMode } from '../../types/scene'

// Keep blades off the river so they never sprout out of the water.
const riverBlobs: Array<[number, number, number, number]> = [
  [13, -22, 4.2, 5.2],
  [12, -15, 4.4, 5.4],
  [13, -8, 4.2, 5.2],
  [16, -1, 4.6, 5.8],
  [18, 6, 4.3, 5.4],
  [17, 13, 4.4, 5.6],
  [15, 20, 4, 5],
]

function isOverWater(x: number, z: number) {
  return riverBlobs.some(([cx, cz, w, l]) => {
    const dx = (x - cx) / w
    const dz = (z - cz) / l
    return dx * dx + dz * dz < 0.95
  })
}

/** How lush each terrain is. Courtyard is mostly paving, so it stays sparse. */
const bladeCountByTerrain: Record<TerrainMode, number> = {
  Riverbank: 5200,
  'Field Path': 5600,
  'Empty Field': 6000,
  'Village Road': 4200,
  Courtyard: 1600,
}

const boardHalf = 23

/**
 * A carpet of instanced grass blades that bend in the shared wind.
 *
 * One InstancedMesh, one material, one draw call. Per-blade variety (height,
 * tilt, hue, phase) rides on instanced attributes, and the vertex shader bends
 * each blade from its root so the base stays planted in the ground.
 */
export function GrassField({ terrainMode }: { terrainMode: TerrainMode }) {
  const meshRef = useRef<InstancedMesh>(null)
  const count = bladeCountByTerrain[terrainMode] ?? 5000

  // A narrow blade, segmented vertically so it can curve rather than shear
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(0.105, 1, 1, 5)
    geo.translate(0, 0.5, 0) // root at the origin so scale.y grows upward
    return geo
  }, [])

  const material = useMemo(() => {
    const mat = new MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.92,
      metalness: 0,
      side: DoubleSide,
    })
    const snowUniform = { value: 0 }

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniforms.uTime
      shader.uniforms.uWindDir = windUniforms.uWindDir
      shader.uniforms.uWindStrength = windUniforms.uWindStrength
      shader.uniforms.uSnow = snowUniform

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform vec2 uWindDir;
          uniform float uWindStrength;
          attribute vec3 aTint;
          attribute float aPhase;
          varying vec3 vTint;
          varying float vBladeH;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTint = aTint;
          vBladeH = uv.y;
          {
            // 0 at the root, 1 at the tip
            float bladeH = clamp(transformed.y, 0.0, 1.0);
            float bend = bladeH * bladeH;
            // Every blade carries a resting arc, so the field looks alive even
            // in dead calm instead of standing up like paper strips
            float restLean = (fract(aPhase * 0.6180339) - 0.5) * 0.55;
            transformed.x += bend * restLean;
            transformed.z += bend * (fract(aPhase * 0.3141592) - 0.5) * 0.35;
            vec3 rootWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float phase = uTime * 2.1
              + aPhase
              + rootWorld.x * 0.42
              + rootWorld.z * 0.35;
            float gust = sin(phase) * 0.7 + sin(phase * 2.3 + 1.1) * 0.3;
            vec3 windWorld = vec3(uWindDir.x, 0.0, uWindDir.y)
              * (bend * uWindStrength * (0.55 + gust * 0.45) * 1.35);
            // Rotate the world-space lean back through model * instance
            mat3 m = mat3(modelMatrix * instanceMatrix);
            float s = max(length(m[0]), 1e-4);
            vec3 localLean = vec3(
              dot(m[0], windWorld),
              dot(m[1], windWorld),
              dot(m[2], windWorld)
            ) / (s * s);
            transformed += localLean;
            // Leaning shortens the blade a touch, as real grass does
            transformed.y -= bend * length(windWorld) * 0.28;
          }`,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uSnow;
          varying vec3 vTint;
          varying float vBladeH;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // Tips catch the light, roots stay in shadow
          vec3 grassTint = vTint * (0.72 + vBladeH * 0.62);
          diffuseColor.rgb *= mix(grassTint, vec3(1.35, 1.42, 1.5), uSnow);`,
        )
    }

    mat.customProgramCacheKey = () => 'grass-blades'
    return { mat, snowUniform }
  }, [])

  // Scatter the blades once per terrain
  const instances = useMemo(() => {
    const dummy = new Object3D()
    const matrices = new Float32Array(count * 16)
    const tints = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const baseColor = new Color('#86ab63')
    const dryColor = new Color('#bcbd7e')
    const lushColor = new Color('#6d9a55')
    const tmp = new Color()

    let placed = 0
    let guard = 0
    // Blades grow in tufts around a wandering centre rather than evenly
    let clumpX = 0
    let clumpZ = 0
    let clumpLeft = 0
    while (placed < count && guard < count * 6) {
      guard += 1

      if (clumpLeft <= 0) {
        clumpX = (Math.random() * 2 - 1) * boardHalf
        clumpZ = (Math.random() * 2 - 1) * boardHalf
        clumpLeft = 3 + Math.floor(Math.random() * 9)
      }
      clumpLeft -= 1
      // Gaussian-ish spread around the tuft centre
      const spread = 0.5 + Math.random() * 1.3
      const x = clumpX + (Math.random() + Math.random() - 1) * spread
      const z = clumpZ + (Math.random() + Math.random() - 1) * spread
      if (Math.abs(x) > boardHalf || Math.abs(z) > boardHalf) continue
      if (isOverWater(x, z)) continue

      // Bias toward shorter blades, with occasional tall stragglers
      const height = 0.15 + Math.pow(Math.random(), 1.9) * 0.34
      dummy.position.set(x, 0, z)
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.22,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.22,
      )
      dummy.scale.set(0.8 + Math.random() * 0.5, height, 1)
      dummy.updateMatrix()
      dummy.matrix.toArray(matrices, placed * 16)

      // Vary the hue so the carpet never reads as one flat green
      const roll = Math.random()
      tmp.copy(baseColor)
      if (roll < 0.33) tmp.lerp(dryColor, Math.random() * 0.7)
      else if (roll > 0.72) tmp.lerp(lushColor, Math.random() * 0.6)
      tmp.multiplyScalar(0.92 + Math.random() * 0.22)
      tints[placed * 3] = tmp.r
      tints[placed * 3 + 1] = tmp.g
      tints[placed * 3 + 2] = tmp.b

      phases[placed] = Math.random() * Math.PI * 2
      placed += 1
    }

    return { matrices, tints, phases, placed }
  }, [count])

  // Upload matrices and per-instance attributes whenever the scatter changes
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const m = new Matrix4()
    for (let i = 0; i < instances.placed; i += 1) {
      m.fromArray(instances.matrices, i * 16)
      mesh.setMatrixAt(i, m)
    }
    mesh.count = instances.placed
    mesh.instanceMatrix.needsUpdate = true

    mesh.geometry.setAttribute(
      'aTint',
      new InstancedBufferAttribute(instances.tints, 3),
    )
    mesh.geometry.setAttribute(
      'aPhase',
      new InstancedBufferAttribute(instances.phases, 1),
    )
  }, [instances, geometry])

  // Snow frosts the blades as it settles
  useFrame(() => {
    const state = useSceneStore.getState()
    const target =
      state.weather === 'snow' ? Math.min(1, state.weatherIntensity * 1.1) : 0
    material.snowUniform.value +=
      (target - material.snowUniform.value) * 0.05
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material.mat, count]}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
