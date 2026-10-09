import { describe, expect, it, vi } from "vitest"

import { uploadFile } from "./upload"

class FakeXhr {
  static last: FakeXhr
  upload = {
    onprogress: null as
      | ((e: {
          lengthComputable: boolean
          loaded: number
          total: number
        }) => void)
      | null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  ontimeout: (() => void) | null = null
  status = 0
  response: unknown = null
  responseType = ""
  open = vi.fn()
  send = vi.fn(() => {
    FakeXhr.last = this
  })
}

describe("uploadFile", () => {
  it("reports progress and resolves the stored item", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    const progress = vi.fn()
    const done = uploadFile(
      "/api/v1/admin/media",
      new File(["x"], "a.png"),
      progress
    )
    FakeXhr.last.upload.onprogress!({
      lengthComputable: true,
      loaded: 5,
      total: 10,
    })
    Object.assign(FakeXhr.last, { status: 201, response: { id: "m1" } })
    FakeXhr.last.onload!()
    await expect(done).resolves.toEqual({ id: "m1" })
    expect(progress).toHaveBeenCalledWith(0.5)
    vi.unstubAllGlobals()
  })
  it("turns the error envelope into an ApiError", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    const done = uploadFile(
      "/api/v1/admin/media",
      new File(["x"], "a.png"),
      () => {}
    )
    Object.assign(FakeXhr.last, {
      status: 400,
      response: {
        error: {
          code: "VALIDATION_FAILED",
          message: "Upload a JPEG",
          requestId: "r",
          fieldErrors: { file: ["Upload a JPEG"] },
        },
      },
    })
    FakeXhr.last.onload!()
    await expect(done).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Upload a JPEG",
    })
    vi.unstubAllGlobals()
  })
  it("explains 413, 415 and 503 in plain words", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    for (const [status, text, code] of [
      [413, "20 MB", "PAYLOAD_TOO_LARGE"],
      [415, "JPEG, PNG, WebP, AVIF or PDF", "BAD_REQUEST"],
      [503, "try again", "UNAVAILABLE"],
    ] as const) {
      const done = uploadFile("/x", new File(["x"], "a.png"), () => {})
      Object.assign(FakeXhr.last, { status, response: null })
      FakeXhr.last.onload!()
      await expect(done).rejects.toMatchObject({ code })
      await expect(done).rejects.toThrow(new RegExp(text, "i"))
    }
    vi.unstubAllGlobals()
  })
  it("refuses oversize and wrong-type files without sending bytes", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    FakeXhr.last = undefined as never
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" })
    Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 })
    await expect(uploadFile("/x", big, () => {})).rejects.toThrow(/20 MB/)
    await expect(
      uploadFile(
        "/x",
        new File(["x"], "a.svg", { type: "image/svg+xml" }),
        () => {}
      )
    ).rejects.toThrow(/JPEG, PNG/)
    expect(FakeXhr.last).toBeUndefined()
    vi.unstubAllGlobals()
  })
  it("treats a dropped connection as a retryable network error", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    const done = uploadFile("/x", new File(["x"], "a.png"), () => {})
    FakeXhr.last.onabort!()
    await expect(done).rejects.toMatchObject({ code: "NETWORK" })
    vi.unstubAllGlobals()
  })
})
