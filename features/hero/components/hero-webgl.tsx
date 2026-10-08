"use client"

import { useEffect, useRef } from "react"
import type { Texture, WebGLRenderer } from "three"

import { gsap, ScrollTrigger } from "@/lib/gsap"
import heroDepth from "@/public/images/hero/hero-depth.png"
import heroHair from "@/public/images/hero/hero-hair.png"
import { heroFragmentShader, heroVertexShader } from "../lib/hero-shader"

// Depth of the woman's torso in hero-depth.png (head ≈ 0.27, torso ≈ 0.33,
// laptop ≈ 0.42, window ≈ 0.0–0.05, floor ≈ 0.56). This plane stays put while
// the room shifts around it.
const FOCUS = 0.33

// 2.5D parallax layer over the hero photo. A virtual camera (pointer via GSAP,
// noise-driven idle sway and breathing, scroll, intro) shifts pixels by their depth
// so the subject separates from the window and wall. The next/image photo
// underneath stays as the LCP image and the fallback; this canvas fades in
// only after its first frame.
//
// In addition to parallax, the shader adds window sunbeams with dust motes,
// passing-cloud light, cloud shadows on the fields, far-field defocus, hair
// breeze and film grain (see hero-shader.ts).
//
// Three.js is dynamically imported during idle time so it never blocks the
// critical LCP paint, hydration, or initial bundle size.
const START_DELAY = 2600

// Smooth 1D value noise. Sums of these never repeat, so the idle camera reads
// as a handheld drift and the light/wind as weather rather than a loop.
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
const noise1 = (x: number) => {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hash(i) * (1 - u) + hash(i + 1) * u
}
// Roughly -1..1.
const drift = (t: number, seed: number) =>
  (noise1(t + seed) * 0.6 +
    noise1(t * 2.3 + seed * 1.7) * 0.3 +
    noise1(t * 5.1 + seed * 3.1) * 0.1) *
    2 -
  1
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}

export function HeroWebGL() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const image = container?.parentElement?.querySelector("img")
    const section = container?.closest("section")
    if (!container || !image || !section) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let cancelled = false
    let idleHandle: number | undefined
    let cleanupFn: (() => void) | undefined

    const start = async () => {
      if (cancelled) return

      // Dynamically load Three.js so it never blocks initial LCP or hydration
      let THREE: typeof import("three")
      try {
        THREE = await import("three")
      } catch {
        return
      }
      if (cancelled) return

      let renderer: WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        })
      } catch {
        return // No WebGL: the static image stays
      }

      const finePointer = matchMedia("(pointer: fine)").matches
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
      const canvas = renderer.domElement
      canvas.className = "absolute inset-0 size-full"
      canvas.style.opacity = "0"
      container.appendChild(canvas)

      const configure = (texture: Texture) => {
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        return texture
      }
      const initCanvas = document.createElement("canvas")
      initCanvas.width = 1
      initCanvas.height = 1
      const ctx = initCanvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "#000000"
        ctx.fillRect(0, 0, 1, 1)
      }
      const photo = configure(new THREE.CanvasTexture(initCanvas))

      const uniforms = {
        uTexture: { value: photo },
        uDepth: { value: photo as Texture },
        uHairMask: { value: photo as Texture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uZoom: { value: 0 },
        uFocus: { value: FOCUS },
        uTime: { value: 0 },
        uLive: { value: 0 },
        uSun: { value: 1 },
        uGust: { value: 0 },
        uDpr: { value: renderer.getPixelRatio() },
      }

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: heroVertexShader,
        fragmentShader: heroFragmentShader,
        depthTest: false,
        depthWrite: false,
      })
      const geometry = new THREE.PlaneGeometry(2, 2)
      const scene = new THREE.Scene()
      scene.add(new THREE.Mesh(geometry, material))
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      const resize = () => {
        const width = container.clientWidth || container.offsetWidth
        const height = container.clientHeight || container.offsetHeight
        if (!width || !height) return
        renderer.setSize(width, height, false)
        uniforms.uResolution.value.set(width, height)
      }
      const resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)
      resize()

      const cam = {
        pointerX: 0,
        pointerY: 0,
        scroll: 0,
        live: 0,
      }

      let ready = false
      let visible = true
      const render = () => {
        if (!ready || !visible) return
        const t = performance.now() * 0.001
        const swayX = drift(t * 0.14, 11)
        const swayY = drift(t * 0.17, 47)
        // ~4.6s breath, quicker inhale than exhale, rate wandering slightly.
        const phase = (((t / 4.6 + drift(t * 0.05, 83) * 0.15) % 1) + 1) % 1
        const breathe =
          phase < 0.4
            ? smoothstep(0, 0.4, phase)
            : 1 - smoothstep(0.4, 1, phase)
        uniforms.uOffset.value.set(
          (cam.pointerX * 0.085 + swayX * 0.03) * cam.live,
          (cam.pointerY * 0.055 + swayY * 0.016) * cam.live + cam.scroll * 0.08
        )
        uniforms.uZoom.value = breathe * 0.035 * cam.live + cam.scroll * 0.35
        uniforms.uTime.value = t
        uniforms.uLive.value = cam.live
        uniforms.uSun.value = smoothstep(-0.55, 0.35, drift(t * 0.035, 191))
        uniforms.uGust.value = smoothstep(-0.3, 0.7, drift(t * 0.12, 257))
        renderer.render(scene, camera)
      }
      gsap.ticker.add(render)

      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
      })
      intersection.observe(container)

      const scrollTrigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => {
          cam.scroll = self.progress
        },
      })

      // Load photo, depth, and hair textures
      const source = new Image()
      source.src = image.currentSrc || image.src
      try {
        const [, depth, hair] = await Promise.all([
          source.decode(),
          new THREE.TextureLoader().loadAsync(heroDepth.src),
          new THREE.TextureLoader().loadAsync(heroHair.src),
        ])
        if (cancelled) {
          depth.dispose()
          hair.dispose()
          return
        }
        uniforms.uDepth.value = configure(depth)
        uniforms.uHairMask.value = configure(hair)
      } catch {
        return
      }

      photo.image = source
      photo.needsUpdate = true
      uniforms.uImageSize.value.set(source.naturalWidth, source.naturalHeight)

      renderer.initTexture(photo)
      renderer.initTexture(uniforms.uDepth.value)
      renderer.initTexture(uniforms.uHairMask.value)
      resize()
      ready = true
      render()
      gsap.to(canvas, { opacity: 1, duration: 0.25, ease: "power1.out" })
      gsap.to(cam, { live: 1, duration: 2.5, ease: "sine.inOut", delay: 0.05 })

      const pointerX = gsap.quickTo(cam, "pointerX", {
        duration: 1.2,
        ease: "power3",
      })
      const pointerY = gsap.quickTo(cam, "pointerY", {
        duration: 1.2,
        ease: "power3",
      })
      const onPointerMove = (event: PointerEvent) => {
        const rect = section.getBoundingClientRect()
        pointerX(((event.clientX - rect.left) / rect.width) * 2 - 1)
        pointerY(-(((event.clientY - rect.top) / rect.height) * 2 - 1))
      }
      const onPointerLeave = () => {
        pointerX(0)
        pointerY(0)
      }
      if (finePointer) {
        section.addEventListener("pointermove", onPointerMove)
        section.addEventListener("pointerleave", onPointerLeave)
      }

      cleanupFn = () => {
        if (finePointer) {
          section.removeEventListener("pointermove", onPointerMove)
          section.removeEventListener("pointerleave", onPointerLeave)
        }
        gsap.ticker.remove(render)
        gsap.killTweensOf([canvas, cam])
        scrollTrigger.kill()
        resizeObserver.disconnect()
        intersection.disconnect()
        geometry.dispose()
        material.dispose()
        photo.dispose()
        if (uniforms.uDepth.value !== photo) uniforms.uDepth.value.dispose()
        if (uniforms.uHairMask.value !== photo)
          uniforms.uHairMask.value.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        canvas.remove()
      }
    }

    const begin = () => {
      idleHandle = window.requestIdleCallback
        ? window.requestIdleCallback(() => start(), { timeout: 1500 })
        : window.setTimeout(start, 0)
    }
    const waitForPhoto = () => {
      if (image.complete && image.naturalWidth) begin()
      else image.addEventListener("load", begin, { once: true })
    }
    const delayTimer = window.setTimeout(waitForPhoto, START_DELAY)

    return () => {
      cancelled = true
      window.clearTimeout(delayTimer)
      if (idleHandle !== undefined) {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle)
        window.clearTimeout(idleHandle)
      }
      image.removeEventListener("load", begin)
      cleanupFn?.()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    />
  )
}
