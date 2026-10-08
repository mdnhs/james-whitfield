export const heroVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// 2.5D depth parallax plus a light pass over the photo: window sunbeams,
// floating dust, passing-cloud light, cloud shadows on the fields, a soft
// far-field defocus, hair breeze and film grain. Every effect scales with
// uLive so the first frame matches the static <img> underneath exactly.
//
// Coordinates: coverUv() returns un-flipped image space (y up, window on the
// right at x > ~0.5). The page shows the photo mirrored.
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
  uniform float uSun;   // 0..1, passing clouds (1 = full sun)
  uniform float uGust;  // 0..1, wind strength
  uniform float uDpr;

  varying vec2 vUv;

  // object-cover + horizontal flip + vertical positioning (matching CSS object-position: center 48%)
  float coverScale() {
    return max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
  }

  vec2 coverUv(vec2 uv) {
    vec2 size = uImageSize * coverScale();
    vec2 align = vec2(0.5, 0.52);
    vec2 cover = (uv * uResolution - (uResolution - size) * align) / size;
    cover.x = 1.0 - cover.x;
    return cover;
  }

  float depthAt(vec2 uv) {
    return texture2D(uDepth, clamp(coverUv(uv), 0.001, 0.999)).r;
  }

  vec2 displace(float depth) {
    float rel = depth - uFocus;
    vec2 center = vec2(0.5);
    // Offset is in screen units; correct x for aspect so motion is uniform.
    vec2 offset = uOffset * vec2(uResolution.y / uResolution.x, 1.0);
    return center + (vUv - center) * (1.0 - uZoom * rel) + offset * rel;
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // One layer of dust motes: a jittered point per cell, wandering slowly and
  // fading in and out so no mote pops.
  float motes(vec2 p, float scale, float seed) {
    p *= scale;
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 r = hash22(cell + seed);
    if (r.x < 0.55) return 0.0;
    vec2 c = 0.3 + 0.4 * hash22(cell + seed + 3.1);
    c += 0.15 * vec2(sin(uTime * 0.31 + r.y * 6.28), cos(uTime * 0.23 + r.x * 6.28));
    float size = mix(0.025, 0.06, r.y);
    float life = sin(fract(uTime * 0.06 + r.y * 7.0) * 3.14159);
    return smoothstep(size, 0.0, length(f - c)) * life;
  }

  void main() {
    // 1. 2.5D depth parallax
    vec2 uv = vUv;
    for (int i = 0; i < 8; i++) {
      uv = displace(depthAt(uv));
    }

    vec2 baseCoverUv = clamp(coverUv(uv), 0.001, 0.999);
    float depth = texture2D(uDepth, baseCoverUv).r;
    float t = uTime;

    // 2. Hair breeze: a drifting noise flow field rather than stacked sines, so
    // strands move unevenly and settle between gusts. Face stays locked.
    float hairWeight = texture2D(uHairMask, baseCoverUv).r;
    vec2 finalCoverUv = baseCoverUv;
    if (hairWeight > 0.05) {
      vec2 q = baseCoverUv * vec2(9.0, 15.0);
      vec2 flow = vec2(
        fbm(q + vec2(t * 0.9, -t * 0.3)),
        fbm(q + vec2(5.2 + t * 0.8, 1.3 - t * 0.25))
      ) - 0.5;
      float flutter = noise(vec2(baseCoverUv.y * 70.0 - t * 3.2, baseCoverUv.x * 9.0)) - 0.5;
      float strength = 0.3 + 0.7 * uGust;
      // Wind comes in through the window, pushing strands into the room.
      vec2 wind = vec2(-0.0034, 0.0012) * flow.x + vec2(-0.0008, 0.0016) * flow.y;
      wind += vec2(-0.0007, 0.0) * flutter * uGust;
      finalCoverUv = clamp(baseCoverUv + wind * strength * hairWeight * uLive, 0.001, 0.999);
    }

    vec3 col = texture2D(uTexture, finalCoverUv).rgb;

    // 3. Soft defocus on the far view through the window and the nearest floor,
    // so the sharp phone photo reads like a lens with real depth of field.
    vec2 px = 1.0 / (uImageSize * coverScale());
    float coc = max(smoothstep(0.1, 0.02, depth) * 1.8, smoothstep(0.52, 0.72, depth) * 1.4) * uLive;
    if (coc > 0.05) {
      vec3 acc = col;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / 8.0) * coc;
        acc += texture2D(uTexture, clamp(finalCoverUv + vec2(cos(a), sin(a)) * r * px, 0.001, 0.999)).rgb;
      }
      col = acc / 9.0;
    }

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float outside = smoothstep(0.08, 0.04, depth);
    float room = 1.0 - outside;

    // 4. Cloud shadows drifting over the fields outside.
    if (outside > 0.01 && baseCoverUv.y < 0.72) {
      float green = smoothstep(0.0, 0.08, col.g - max(col.r, col.b) * 0.92);
      float shade = smoothstep(0.45, 0.75, fbm(baseCoverUv * vec2(2.5, 7.0) + vec2(t * 0.018, t * 0.004)));
      col *= 1.0 - shade * 0.16 * green * outside * uLive;
    }

    // 5. Passing clouds: sunlit surfaces dim and recover together.
    float lit = smoothstep(0.5, 0.92, lum);
    float sun = mix(0.9, 1.04, uSun);
    col *= mix(1.0, sun, lit * uLive);

    // 6. Volumetric sunbeams through the window, slanting down into the room.
    vec2 aspect = vec2(uImageSize.x / uImageSize.y, 1.0);
    vec2 ip = baseCoverUv * aspect;
    vec2 L = normalize(vec2(-0.72, -0.69));
    float across = dot(ip, vec2(-L.y, L.x));
    float beam = fbm(vec2(across * 6.0 + t * 0.012, t * 0.025));
    beam = smoothstep(0.42, 0.78, beam);
    float fromWindow = smoothstep(0.02, 0.5, baseCoverUv.x) * smoothstep(0.98, 0.55, baseCoverUv.y);
    float haze = beam * fromWindow * room * mix(0.25, 1.0, uSun);
    vec3 warm = vec3(1.0, 0.86, 0.66);
    col = 1.0 - (1.0 - col) * (1.0 - warm * haze * 0.11 * uLive);

    // 7. Dust motes, only visible where light catches them. Two layers at
    // different scales and parallax read as a volume of air.
    vec2 sp = vUv * vec2(uResolution.x / uResolution.y, 1.0);
    vec2 drift = vec2(0.006, 0.012) * t;
    float dust = motes(sp + drift + uOffset * 0.35, 26.0, 1.0);
    dust += motes(sp + drift * 1.6 + uOffset * 0.7, 15.0, 7.0) * 0.8;
    col += warm * dust * (haze * 0.7 + 0.08 * room) * 0.55 * uLive;

    // 8. Lens vignette and 24fps film grain, strongest in the midtones.
    vec2 vc = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    col *= mix(1.0, smoothstep(1.25, 0.35, length(vc)) * 0.12 + 0.88, uLive);
    float frame = floor(t * 24.0);
    float grain = hash12(floor(gl_FragCoord.xy / uDpr) + frame * vec2(37.0, 17.0)) - 0.5;
    col += grain * 0.05 * (1.0 - abs(lum - 0.5) * 1.3) * uLive;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`
