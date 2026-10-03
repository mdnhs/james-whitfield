export const heroVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// 2.5D depth parallax. A depth map (white = near, black = far) tells each pixel
// how far it is from the camera; moving a virtual camera (uOffset) shifts near
// and far pixels by different amounts, so the woman and chair separate from the
// window and wall behind her. uFocus is the depth that stays put (her plane),
// so the room appears to orbit around her. uZoom pushes near pixels forward
// more than far ones (a dolly), used for scroll, the intro and breathing.
export const heroFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform sampler2D uDepth;
  uniform vec2 uResolution;
  uniform vec2 uImageSize;
  uniform vec2 uOffset;
  uniform float uZoom;
  uniform float uFocus;

  varying vec2 vUv;

  // object-cover + horizontal flip, matching the CSS image underneath.
  vec2 coverUv(vec2 uv) {
    float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
    vec2 size = uImageSize * scale;
    vec2 cover = (uv * uResolution - (uResolution - size) * 0.5) / size;
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
    // Fixed-point refinement: look up depth where the displaced ray lands,
    // not where it started, which keeps silhouettes from tearing.
    vec2 uv = vUv;
    for (int i = 0; i < 8; i++) {
      uv = displace(depthAt(uv));
    }

    gl_FragColor = vec4(texture2D(uTexture, clamp(coverUv(uv), 0.0, 1.0)).rgb, 1.0);
  }
`
