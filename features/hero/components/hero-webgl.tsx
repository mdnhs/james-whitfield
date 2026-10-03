"use client"

import { useEffect, useRef } from "react"
import {
  ClampToEdgeWrapping,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three"

import { gsap, ScrollTrigger } from "@/lib/gsap"
import heroDepth from "@/public/images/hero/hero-depth.png"
import { heroFragmentShader, heroVertexShader } from "../lib/hero-shader"

// Depth of the woman's torso in hero-depth.png (head ≈ 0.27, torso ≈ 0.33,
// laptop ≈ 0.42, window ≈ 0.0–0.05, floor ≈ 0.56). This plane stays put while
// the room shifts around it.
const FOCUS = 0.33

// 2.5D parallax layer over the hero photo. A virtual camera, moved by GSAP
// (pointer, idle sway, breathing, scroll, intro), shifts pixels by their depth
// so the subject separates from the window and wall. The next/image photo
// underneath stays as the LCP image and the fallback; this canvas fades in
// only after its first frame.
export function HeroWebGL() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const image = container?.parentElement?.querySelector("img")
    const section = container?.closest("section")
    if (!container || !image || !section) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" })
    } catch {
      return // No WebGL: the static image stays.
    }

    const finePointer = matchMedia("(pointer: fine)").matches
    renderer.setPixelRatio(Math.min(devicePixelRatio, finePointer ? 1.5 : 1))
    const canvas = renderer.domElement
    canvas.className = "absolute inset-0 size-full"
    canvas.style.opacity = "0"
    container.appendChild(canvas)

    const configure = (texture: Texture) => {
      texture.wrapS = texture.wrapT = ClampToEdgeWrapping
      texture.minFilter = texture.magFilter = LinearFilter
      texture.generateMipmaps = false
      return texture
    }
    const photo = configure(new Texture())

    const uniforms = {
      uTexture: { value: photo },
      uDepth: { value: photo as Texture },
      uResolution: { value: new Vector2(1, 1) },
      uImageSize: { value: new Vector2(1, 1) },
      uOffset: { value: new Vector2(0, 0) },
      uZoom: { value: 0 },
      uFocus: { value: FOCUS },
    }

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: heroVertexShader,
      fragmentShader: heroFragmentShader,
      depthTest: false,
      depthWrite: false,
    })
    const geometry = new PlaneGeometry(2, 2)
    const scene = new Scene()
    scene.add(new Mesh(geometry, material))
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      uniforms.uResolution.value.set(width, height)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    // Virtual camera. Each source is tweened independently by GSAP and summed
    // per frame. Units: fraction of the image height at full depth difference.
    const cam = {
      pointerX: 0, pointerY: 0, // -1..1, eased
      swayX: -1, swayY: -1, // idle orbit
      breathe: 0, // 0..1
      scroll: 0, // 0..1 while the hero scrolls away
      introX: 0.11, introY: -0.06, introZoom: 0.3,
    }

    let ready = false
    let visible = true
    const render = () => {
      if (!ready || !visible) return
      uniforms.uOffset.value.set(
        cam.pointerX * 0.085 + cam.swayX * 0.026 + cam.introX,
        cam.pointerY * 0.055 + cam.swayY * 0.014 + cam.introY + cam.scroll * 0.08
      )
      uniforms.uZoom.value = cam.introZoom + cam.breathe * 0.04 + cam.scroll * 0.35
      renderer.render(scene, camera)
    }
    gsap.ticker.add(render)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    intersection.observe(container)

    // Idle life: a slow orbit and breathing dolly, always running.
    const idle = [
      gsap.to(cam, { swayX: 1, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1 }),
      gsap.to(cam, { swayY: 1, duration: 5.2, ease: "sine.inOut", yoyo: true, repeat: -1 }),
      gsap.to(cam, { breathe: 1, duration: 4.2, ease: "sine.inOut", yoyo: true, repeat: -1 }),
    ]

    // Scroll: the camera pushes in on her as the hero leaves.
    const scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        cam.scroll = self.progress
      },
    })

    // Load the photo (same URL next/image already fetched, so from cache) and
    // the depth map. A detached Image is used because the on-page <img> reports
    // its CSS layout size as width/height, which breaks the texture upload.
    let cancelled = false
    const start = async () => {
      const source = new Image()
      source.src = image.currentSrc || image.src
      try {
        const [, depth] = await Promise.all([
          source.decode(),
          new TextureLoader().loadAsync(heroDepth.src),
        ])
        if (cancelled) return depth.dispose()
        uniforms.uDepth.value = configure(depth)
      } catch {
        return
      }
      photo.image = source
      photo.needsUpdate = true
      uniforms.uImageSize.value.set(source.naturalWidth, source.naturalHeight)
      ready = true
      render()
      gsap.to(canvas, { opacity: 1, duration: 0.6, ease: "power1.out" })
      gsap.to(cam, { introX: 0, introY: 0, introZoom: 0, duration: 3, ease: "expo.out" })
    }
    if (image.complete && image.naturalWidth) start()
    else image.addEventListener("load", start, { once: true })

    // Pointer: the camera follows the cursor around her.
    const pointerX = gsap.quickTo(cam, "pointerX", { duration: 1.2, ease: "power3" })
    const pointerY = gsap.quickTo(cam, "pointerY", { duration: 1.2, ease: "power3" })
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

    return () => {
      cancelled = true
      image.removeEventListener("load", start)
      section.removeEventListener("pointermove", onPointerMove)
      section.removeEventListener("pointerleave", onPointerLeave)
      gsap.ticker.remove(render)
      idle.forEach((tween) => tween.kill())
      gsap.killTweensOf([canvas, cam])
      scrollTrigger.kill()
      resizeObserver.disconnect()
      intersection.disconnect()
      geometry.dispose()
      material.dispose()
      photo.dispose()
      if (uniforms.uDepth.value !== photo) uniforms.uDepth.value.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return <div ref={containerRef} aria-hidden className="pointer-events-none absolute inset-0" />
}
