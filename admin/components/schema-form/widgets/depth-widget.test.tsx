// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import * as z from "zod"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { BLOCK_FIELD_UI } from "@/admin/modules/pages/block-ui"
import { heroHome } from "@/blocks/home"
import { permissionMap } from "@/lib/auth/permissions"

import { SchemaForm } from "../schema-form"

// transformers.js is mocked: the pipeline returns a 2x1 depth image.
const estimate = vi.fn<(image: unknown) => Promise<unknown>>(async () => ({
  depth: { data: new Uint8Array([10, 200]), width: 2, height: 1, channels: 1 },
}))
const pipeline = vi.fn<(...args: unknown[]) => Promise<typeof estimate>>(
  async () => estimate
)
vi.mock("./transformers", () => ({
  loadTransformers: async () => ({
    pipeline: (...args: unknown[]) => pipeline(...args),
    RawImage: class {
      constructor(
        public data: unknown,
        public width: number,
        public height: number,
        public channels: number
      ) {}
    },
  }),
}))

const uploadFile = vi.fn()
vi.mock("@/admin/modules/media/upload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}))

const PHOTO = "11111111-1111-4111-8111-111111111111"
const DEPTH = "22222222-2222-4222-8222-222222222222"
const item = (id: string, url: string, filename: string) => ({
  id,
  filename,
  alt: filename,
  mimeType: "image/png",
  url,
  width: 1600,
  height: 900,
  focalX: 0.5,
  focalY: 0.5,
})
const photo = item(PHOTO, "/uploads/field.jpg", "field.jpg")
const depthItem = item(DEPTH, "/uploads/field-depth.png", "field-depth.png")

const owner = {
  user: { id: "u1", email: "o@example.com", name: "O" },
  roles: ["owner" as const],
  permissions: permissionMap(["owner"]),
  twoFactorEnabled: true,
  impersonatedBy: null,
}

// jsdom has no canvas or image decoding.
beforeEach(() => {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D
  )
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["png"], { type: "image/png" }))
  )
  HTMLImageElement.prototype.decode = () => Promise.resolve()
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    configurable: true,
    get: () => 1600,
  })
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    configurable: true,
    get: () => 900,
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(DEPTH))
        return Response.json({
          items: [depthItem],
          page: 1,
          pageSize: 40,
          total: 1,
        })
      if (/\/media\/[0-9a-f-]+$/.test(new URL(url, "http://x").pathname))
        return Response.json(depthItem)
      return Response.json({ items: [photo], page: 1, pageSize: 40, total: 1 })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  uploadFile.mockReset()
  estimate.mockClear()
  pipeline.mockClear()
})

const schema = z.object({ background: heroHome.schema.shape.background })

function renderForm(onSubmit: (value: unknown) => void) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminActorProvider value={owner}>
        <SchemaForm
          schema={schema}
          defaultValues={{ background: { image: null, depth: null } }}
          overrides={BLOCK_FIELD_UI["hero.home"]}
          onSubmit={onSubmit}
          submitLabel="Save"
        />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

describe("depth map widget", () => {
  it("builds, uploads and sets the depth map when a photo is picked", async () => {
    let finish: (value: unknown) => void = () => {}
    uploadFile.mockImplementation(
      () => new Promise((resolve) => (finish = resolve))
    )
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderForm(onSubmit)

    // The widget loads on demand (next/dynamic, browser only).
    expect(
      await screen.findByText("Choose a background photo first.")
    ).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Background photo" }))
    await user.click(await screen.findByRole("button", { name: /field\.jpg/ }))

    expect(await screen.findByText("Building depth map…")).toBeTruthy()
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1))
    const [url, file] = uploadFile.mock.calls[0]!
    expect(url).toBe("/api/v1/admin/media")
    expect((file as File).name).toBe("field-depth.png")
    expect((file as File).type).toBe("image/png")
    expect(pipeline).toHaveBeenCalledWith(
      "depth-estimation",
      "onnx-community/depth-anything-v2-small",
      expect.objectContaining({ device: "wasm" })
    )
    expect(estimate).toHaveBeenCalledTimes(1)

    finish(depthItem)
    expect(
      await screen.findByRole("img", { name: "Depth map preview" })
    ).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        background: { image: { mediaId: PHOTO }, depth: { mediaId: DEPTH } },
      })
    )
    expect(
      screen.getByRole("button", { name: "Regenerate depth map" })
    ).toBeTruthy()
  })

  it("says so when it fails, and leaves the depth map unset", async () => {
    estimate.mockRejectedValueOnce(new Error("model blocked"))
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderForm(onSubmit)

    await user.click(screen.getByRole("button", { name: "Background photo" }))
    await user.click(await screen.findByRole("button", { name: /field\.jpg/ }))
    expect(
      await screen.findByText(/Couldn't build the depth map \(model blocked\)/)
    ).toBeTruthy()
    expect(uploadFile).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        background: { image: { mediaId: PHOTO }, depth: null },
      })
    )
  })
})
