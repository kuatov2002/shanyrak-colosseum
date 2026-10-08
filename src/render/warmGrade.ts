// Custom WebGL filter: "warm night grade". One pass that gives the whole world a single colour
// temperature: a gentle S-curve for contrast, cool indigo shadows at night (one white balance for
// every room) and warm lifted highlights (window light, lanterns, the shanyrak glow). No grain, no
// chromatic aberration. Falls back to a ColorMatrixFilter if the shader cannot be compiled.

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
  // gentle S-curve (contrast) that keeps black and white where they are
  vec3 s = rgb * rgb * (3.0 - 2.0 * rgb);
  rgb = mix(rgb, s, 0.28);
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  // one night white balance for the whole frame: mids lean cool
  rgb = mix(rgb, rgb * vec3(0.93, 0.96, 1.05), uNight * 0.7);
  // warm highlights: bright pixels where red dominates blue (window light, lanterns, gold)
  float warm = smoothstep(0.45, 0.9, lum) * clamp((rgb.r - rgb.b) * 2.0, 0.0, 1.0);
  vec3 lifted = rgb + warm * uWarmth * vec3(0.16, 0.1, 0.02);
  // cooler, deeper shadows at night
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
