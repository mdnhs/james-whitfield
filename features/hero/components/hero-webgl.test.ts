import { describe, expect, it } from "vitest"

import { isSoftwareRenderer } from "./hero-webgl"

const RENDERER = 0x1f01
const UNMASKED = 0x9246
const gl = (name: string | null, debugInfo = true) =>
  ({
    RENDERER,
    getExtension: () =>
      debugInfo ? { UNMASKED_RENDERER_WEBGL: UNMASKED } : null,
    getParameter: () => name,
  }) as unknown as WebGLRenderingContext

describe("isSoftwareRenderer", () => {
  it("spots CPU renderers", () => {
    expect(
      isSoftwareRenderer(
        gl(
          "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)"
        )
      )
    ).toBe(true)
    expect(isSoftwareRenderer(gl("llvmpipe (LLVM 15.0.7, 256 bits)"))).toBe(
      true
    )
    expect(
      isSoftwareRenderer(gl("Microsoft Basic Render Driver Software", false))
    ).toBe(true)
  })

  it("keeps the effect on GPUs and when the name is hidden", () => {
    expect(
      isSoftwareRenderer(gl("ANGLE (Apple, ANGLE Metal Renderer: Apple M2)"))
    ).toBe(false)
    expect(isSoftwareRenderer(gl("WebKit WebGL", false))).toBe(false)
    expect(isSoftwareRenderer(gl(null))).toBe(false)
  })
})
