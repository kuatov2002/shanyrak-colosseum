// Custom WebGL filter: "warm night grade". At night it cools the shadows toward indigo and lifts
// warm highlights (window light, lanterns, the shanyrak glow) — the cosy campus look in one pass.
// Falls back to a ColorMatrixFilter if the shader cannot be compiled.

import { ColorMatrixFilter, Filter, GlProgram } from "pixi.js";

const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uNight;
uniform float uWarmth;

void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.0) { finalColor = c; return; }
  vec3 rgb = c.rgb / c.a;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  // warm highlights: bright pixels where red dominates blue (window light, lanterns, gold)
  float warm = smoothstep(0.45, 0.9, lum) * clamp((rgb.r - rgb.b) * 2.0, 0.0, 1.0);
  vec3 lifted = rgb + warm * uWarmth * vec3(0.18, 0.11, 0.02);
  // cool shadows at night
  float shadow = 1.0 - smoothstep(0.15, 0.6, lum);
  vec3 night = mix(lifted, lifted * vec3(0.82, 0.86, 1.08), shadow * uNight);
  finalColor = vec4(clamp(night, 0.0, 1.0) * c.a, c.a);
}
`;

export interface Grade {
  filter: Filter;
  set(night: number, warmth: number): void;
}

export function createWarmGrade(): Grade {
  try {
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex, fragment, name: "warm-grade" }),
      resources: {
        gradeUniforms: {
          uNight: { value: 0, type: "f32" },
          uWarmth: { value: 1, type: "f32" },
        },
      },
    });
    const u = (filter.resources.gradeUniforms as { uniforms: { uNight: number; uWarmth: number } }).uniforms;
    return {
      filter,
      set(night, warmth) {
        u.uNight = night;
        u.uWarmth = warmth;
      },
    };
  } catch {
    const cm = new ColorMatrixFilter();
    return {
      filter: cm,
      set(night) {
        cm.reset();
        cm.brightness(1 - night * 0.08, false);
      },
    };
  }
}
