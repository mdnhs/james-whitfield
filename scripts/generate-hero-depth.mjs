// One-off: generates the hero depth map used by the 2.5D WebGL parallax.
// Runs Depth Anything V2 (small) locally via transformers.js — nothing runs at
// site runtime; the output PNG is a committed asset.
//
//   node scripts/generate-hero-depth.mjs
//
// Output: public/images/hero/hero-depth.png (white = near, black = far),
// slightly blurred so the parallax stretches smoothly at object edges.

import { createRequire } from "node:module"
import { env, pipeline, RawImage } from "@huggingface/transformers"

const SOURCE = "public/images/hero/hero-bg.png"
const OUTPUT = "public/images/hero/hero-depth.png"
const WIDTH = 1071 // 1/4 of the 4284px source; plenty for a depth texture

env.cacheDir = "./node_modules/.cache/transformers"

const estimator = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
  dtype: "fp32",
})

const image = await RawImage.read(SOURCE)
const resized = await image.resize(WIDTH, Math.round((image.height / image.width) * WIDTH))
const { depth } = await estimator(resized)

// sharp ships with transformers.js; resolve it from there.
const require = createRequire(import.meta.resolve("@huggingface/transformers"))
const sharp = require("sharp")

await sharp(Buffer.from(depth.data), {
  raw: { width: depth.width, height: depth.height, channels: depth.channels },
})
  .normalise()
  .blur(4)
  .png()
  .toFile(OUTPUT)

console.log(`Saved ${OUTPUT} (${depth.width}×${depth.height})`)
