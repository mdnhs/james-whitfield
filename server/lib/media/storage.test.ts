import { describe, expect, it } from "vitest"

import { localFile, s3Config } from "./storage"

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
