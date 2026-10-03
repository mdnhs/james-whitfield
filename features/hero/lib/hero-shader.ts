export const heroVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// 2.5D depth parallax and natural hair breeze animation.
export const heroFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform sampler2D uDepth;
  uniform sampler2D uHairMask;
  uniform vec2 uResolution;
  uniform vec2 uImageSize;
  uniform vec2 uOffset;
  uniform float uZoom;
  uniform float uFocus;
  uniform float uTime;
  uniform float uLive;

  varying vec2 vUv;

  // object-cover + horizontal flip + vertical positioning (matching CSS object-position: center 48%)
  vec2 coverUv(vec2 uv) {
    float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
    vec2 size = uImageSize * scale;
    vec2 align = vec2(0.5, 0.52);
    vec2 cover = (uv * uResolution - (uResolution - size) * align) / size;
    cover.x = 1.0 - cover.x;
    return cover;
  }

  float depthAt(vec2 uv) {
    return texture2D(uDepth, clamp(coverUv(uv), 0.0, 1.0)).r;
  }

  vec2 displace(float depth) {
    float rel = depth - uFocus;
    vec2 center = vec2(0.5);
    // Offset is in screen units; correct x for aspect so motion is uniform.
    vec2 offset = uOffset * vec2(uResolution.y / uResolution.x, 1.0);
    return center + (vUv - center) * (1.0 - uZoom * rel) + offset * rel;
  }

  void main() {
    // 1. 2.5D Depth parallax iteration
    vec2 uv = vUv;
    for (int i = 0; i < 8; i++) {
      uv = displace(depthAt(uv));
    }

    vec2 baseCoverUv = clamp(coverUv(uv), 0.0, 1.0);

    // 2. Gentle hair breeze displacement (ONLY hair strands, face is 100% locked)
    float hairWeight = texture2D(uHairMask, baseCoverUv).r;
    vec2 finalCoverUv = baseCoverUv;

    if (hairWeight > 0.05) {
      float t = uTime * 2.2;
      float w1 = sin(t + baseCoverUv.y * 36.0 + baseCoverUv.x * 20.0);
      float w2 = cos(t * 1.5 - baseCoverUv.y * 46.0 + baseCoverUv.x * 26.0);
      float w3 = sin(t * 3.1 + baseCoverUv.y * 58.0);
      float gust = sin(uTime * 0.65) * 0.28 + 0.72;
      
      float wave = (w1 * 0.52 + w2 * 0.33 + w3 * 0.15) * gust;
      
      // Breeze blows from window towards room interior on hair tips
      vec2 hairOffset = vec2(-0.0022, 0.0011) * wave * hairWeight * uLive;
      finalCoverUv = clamp(baseCoverUv + hairOffset, 0.0, 1.0);
    }

    // Render original photograph with hair breeze
    gl_FragColor = vec4(texture2D(uTexture, finalCoverUv).rgb, 1.0);
  }
`
