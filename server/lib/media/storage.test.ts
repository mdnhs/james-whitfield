import { describe, expect, it } from "vitest"

import {
  contentDisposition,
  localFile,
  MEDIA_KEY,
  s3Config,
  variantKey,
} from "./storage"

describe("media storage", () => {
  it("targets the R2 EU endpoint and only checksums when required", () => {
    const config = s3Config({
      S3_ACCOUNT_ID: "acct",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    })
    expect(config).toMatchObject({
      endpoint: "https://acct.eu.r2.cloudflarestorage.com",
      region: "auto",
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      forcePathStyle: false,
    })
  })
  it("uses an explicit endpoint (S3 or a local emulator) with path-style URLs", () => {
    expect(
      s3Config({
        S3_ENDPOINT: "http://localhost:9000",
        S3_ACCESS_KEY_ID: "k",
        S3_SECRET_ACCESS_KEY: "s",
      })
    ).toMatchObject({
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
    })
  })
  it.each([
    "../etc/passwd",
    "media/2026/10/../../x.jpg",
    "media/2026/10/abc.svg",
    "/etc/passwd",
  ])("never resolves %s", (key) =>
    expect(localFile(key, "/srv/storage")).toBeNull()
  )
  it("resolves a well-formed key inside the directory", () => {
    expect(
      localFile("media/2026/10/0123456789abcdef-photo.jpg", "/srv/storage")
    ).toEqual({
      path: "/srv/storage/media/2026/10/0123456789abcdef-photo.jpg",
      mimeType: "image/jpeg",
    })
  })
})

describe("media keys", () => {
  it("downloads PDFs under their slug and leaves images inline", () => {
    expect(
      contentDisposition("media/2026/10/0123456789abcdef-brochure.pdf")
    ).toBe('attachment; filename="brochure.pdf"')
    expect(
      contentDisposition("media/2026/10/0123456789abcdef-photo.jpg")
    ).toBeUndefined()
  })
  it("makes a distinct, still well-formed key for the same bytes", () => {
    const key = `media/2026/10/0123456789abcdef-${"a".repeat(60)}.png`
    const variant = variantKey(key)
    expect(variant).not.toBe(key)
    expect(variant.startsWith("media/2026/10/0123456789abcdef-")).toBe(true)
    expect(MEDIA_KEY.test(variant)).toBe(true)
  })
})
