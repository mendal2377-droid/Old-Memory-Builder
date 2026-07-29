/* eslint-disable react-hooks/immutability */

import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, ShaderMaterial } from 'three'
import type { AtmospherePreset } from '../../types/scene'

interface WaterColors {
  deep: string
  shallow: string
  highlight: string
}

const waterColorsByPreset: Record<AtmospherePreset, WaterColors> = {
  'Clear Morning': { deep: '#2f6d94', shallow: '#6fc0dd', highlight: '#eafaff' },
  Sunset: { deep: '#3f597a', shallow: '#cf9a70', highlight: '#ffe0bc' },
  'Rainy Day': { deep: '#39505c', shallow: '#7595a2', highlight: '#d2e6ee' },
  'Heavy Rain': { deep: '#324551', shallow: '#5f7d8a', highlight: '#c6dae2' },
  'Snowy Day': { deep: '#48697a', shallow: '#a2c6d6', highlight: '#eef7fb' },
  'Summer Night': { deep: '#152a40', shallow: '#2f5074', highlight: '#a6c7ff' },
}

const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying float vViewY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    vViewY = viewDir.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying float vViewY;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHighlight;
  uniform float uOpacity;
  uniform float uChoppy;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 p = vWorldPos.xz;
    float t = uTime;
    float w1 = sin(p.x * 1.25 + t * 1.35);
    float w2 = sin(p.y * 1.7 - t * 1.05 + p.x * 0.5);
    float w3 = sin((p.x + p.y) * 2.3 + t * 1.9);
    float ripple = ((w1 + w2 + w3) / 3.0) * 0.5 + 0.5;
    float nBase = noise(p * 2.4 + vec2(t * 0.22, -t * 0.16));
    float nFine = noise(p * 6.5 - vec2(t * 0.45, t * 0.3));
    float sparkle = smoothstep(0.84, 1.0, nFine * (0.45 + 0.55 * ripple));
    float fres = pow(1.0 - clamp(abs(vViewY), 0.0, 1.0), 3.0);
    vec3 col = mix(uDeep, uShallow, clamp(ripple * 0.7 + nBase * 0.25, 0.0, 1.0));
    col = mix(col, uHighlight, fres * 0.5);
    col += uHighlight * sparkle * (0.7 + 0.4 * uChoppy);
    float alpha = uOpacity + fres * 0.28 + sparkle * 0.3;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`

function makeWaterMaterial(
  preset: AtmospherePreset,
  opacity: number,
): ShaderMaterial {
  const colors = waterColorsByPreset[preset]
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new Color(colors.deep) },
      uShallow: { value: new Color(colors.shallow) },
      uHighlight: { value: new Color(colors.highlight) },
      uOpacity: { value: opacity },
      uChoppy: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  })
}

export function useWaterMaterial(
  preset: AtmospherePreset,
  opacity: number,
  speed = 1,
  choppy = 0.9,
) {
  const material = useMemo(
    () => makeWaterMaterial(preset, opacity),
    [preset, opacity],
  )

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime * speed
    material.uniforms.uChoppy.value = choppy
  })

  return material
}
