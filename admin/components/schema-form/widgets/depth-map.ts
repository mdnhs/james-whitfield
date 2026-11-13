"use client"

import {
  DEPTH_MAX_EDGE,
  depthToRgba,
  fitSize,
} from "@/features/hero/lib/background"

import { loadTransformers } from "./transformers"

// Depth Anything V2 (small), ONNX build for transformers.js. The download
// (~25 MB quantised for wasm, more in fp16 for WebGPU) is cached by the
// browser after the first run.
export const DEPTH_MODEL = "onnx-community/depth-anything-v2-small"

type Device = "webgpu" | "wasm"
type Estimator = (image: unknown) => Promise<unknown>

let estimator: Promise<Estimator> | null = null

async function hasWebGpu(): Promise<boolean> {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> }
    }
  ).gpu
  if (!gpu) return false
  try {
    return Boolean(await gpu.requestAdapter())
  } catch {
    return false
  }
}

// Loaded on demand, in the admin only: transformers.js never reaches the
// public bundle. WebGPU when the browser has it, else wasm.
function loadEstimator(): Promise<Estimator> {
  estimator ??= (async () => {
    const { pipeline } = await loadTransformers()
    const make = (device: Device) =>
      pipeline("depth-estimation", DEPTH_MODEL, {
        device,
        dtype: device === "webgpu" ? "fp16" : "q8",
      }) as unknown as Promise<Estimator>
    if (await hasWebGpu()) {
      try {
        return await make("webgpu")
      } catch {
        // Some adapters lack fp16 or a needed op: wasm always works.
      }
    }
    return make("wasm")
  })()
  // A failed load (offline, blocked) may succeed on the next try.
  estimator.catch(() => {
    estimator = null
  })
  return estimator
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.decoding = "async"
  image.src = src
  return image.decode().then(() => image)
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("This browser cannot draw to a canvas.")
  return { canvas, ctx }
}

// The pipeline's output: a RawImage of the depth (one channel, the input's
// size, larger = nearer).
type DepthImage = {
  data: ArrayLike<number>
  width: number
  height: number
  channels: number
}
function depthImageOf(output: unknown): DepthImage {
  const first = Array.isArray(output) ? output[0] : output
  const depth = (first as { depth?: DepthImage } | undefined)?.depth
  if (!depth?.data || !depth.width || !depth.height)
    throw new Error("The model returned no depth.")
  return depth
}

// A photo URL (same origin) → its depth map as a grayscale PNG, at most
// DEPTH_MAX_EDGE px on the long edge, near = bright like hero-depth.png.
// Like scripts/generate-hero-depth.mjs (which made the bundled map): the
// range is stretched and the map slightly blurred, so the parallax
// stretches smoothly at object edges.
export async function buildDepthMap(src: string): Promise<Blob> {
  const photo = await loadImage(src)
  const size = fitSize(photo.naturalWidth, photo.naturalHeight, DEPTH_MAX_EDGE)
  if (!size.width) throw new Error("The photo could not be read.")
  const input = canvas2d(size.width, size.height)
  input.ctx.drawImage(photo, 0, 0, size.width, size.height)
  const pixels = input.ctx.getImageData(0, 0, size.width, size.height)

  const [{ RawImage }, estimate] = await Promise.all([
    loadTransformers(),
    loadEstimator(),
  ])
  const depth = depthImageOf(
    await estimate(new RawImage(pixels.data, size.width, size.height, 4))
  )

  const out = canvas2d(depth.width, depth.height)
  const image = out.ctx.createImageData(depth.width, depth.height)
  image.data.set(
    depthToRgba(depth.data, depth.width, depth.height, depth.channels || 1)
  )
  out.ctx.putImageData(image, 0, 0)
  // sharp's blur(4) at 1071 px wide, scaled to this map. Browsers without
  // canvas filters skip it; the map still works.
  const soft = canvas2d(depth.width, depth.height)
  soft.ctx.filter = `blur(${((4 * Math.max(depth.width, depth.height)) / 1071).toFixed(1)}px)`
  soft.ctx.drawImage(out.canvas, 0, 0)
  return new Promise((resolve, reject) =>
    soft.canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the PNG.")),
      "image/png"
    )
  )
}

// The photo as a same-origin URL: remote media (the s3 driver) goes through
// the image optimizer, so the canvas stays readable without CORS.
export function sameOriginSrc(url: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=1920&q=90`
}
