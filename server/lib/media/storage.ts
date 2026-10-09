import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type { S3Client } from "@aws-sdk/client-s3"

import { getEnv, type Env } from "@/server/env"

export const MEDIA_KEY =
  /^media\/\d{4}\/\d{2}\/[a-f0-9]{16}-[a-z0-9-]{1,60}\.(jpg|png|webp|avif|pdf)$/

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
} as const

export type StorageDriver = {
  name: "local" | "s3"
  put(key: string, body: Buffer, mimeType: string): Promise<void>
  urlFor(key: string): string
}

// A key that passes MEDIA_KEY cannot climb out of the directory; the prefix
// check is a second lock.
export function localFile(key: string, dir = getEnv().MEDIA_LOCAL_DIR) {
  const match = MEDIA_KEY.exec(key)
  if (!match) return null
  const root = path.resolve(dir)
  const file = path.resolve(root, key)
  if (!file.startsWith(root + path.sep)) return null
  return {
    path: file,
    mimeType: MIME_BY_EXT[match[1] as keyof typeof MIME_BY_EXT],
  }
}

// PDFs download rather than render (docs/brief.md §14): Chrome's viewer
// refuses to run under the CSP sandbox /uploads sends, and R2 cannot send a
// CSP at all, so both drivers make the same, inert choice. Images stay inline.
export function contentDisposition(key: string) {
  const match = MEDIA_KEY.exec(key)
  if (match?.[1] !== "pdf") return undefined
  // The slug part of a MEDIA_KEY is [a-z0-9-] only: safe inside quotes.
  const name = key.slice(key.lastIndexOf("/") + 18)
  return `attachment; filename="${name}"`
}

// A second key for the same bytes, for a duplicate upload that must not share
// a row (a soft-deleted one, or another user's file an author may not edit).
export function variantKey(key: string) {
  const match = /^(.*\/[a-f0-9]{16}-)([a-z0-9-]+)\.([a-z]+)$/.exec(key)
  if (!match) throw new Error(`Refusing media key ${key}`)
  const suffix = randomUUID().slice(0, 8)
  return `${match[1]}${match[2]!.slice(0, 51).replace(/-$/, "")}-${suffix}.${match[3]}`
}

type S3Env = Pick<
  Env,
  "S3_ACCOUNT_ID" | "S3_ENDPOINT" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY"
>

// R2's EU jurisdiction endpoint unless an explicit one is given (S3, or a
// local RustFS emulator). R2 rejects the SDK's default CRC checksums, hence
// WHEN_REQUIRED (docs/plan.md Phase 4.7).
export function s3Config(env: S3Env) {
  return {
    region: "auto",
    endpoint:
      env.S3_ENDPOINT ??
      `https://${env.S3_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    },
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
  }
}

const CACHE = "public, max-age=31536000, immutable"

let cached: StorageDriver | undefined

export function getStorage(): StorageDriver {
  if (cached) return cached
  const env = getEnv()
  if (env.MEDIA_DRIVER === "s3") {
    const base = env.MEDIA_PUBLIC_URL!.replace(/\/$/, "")
    // One client per process (it pools connections); the SDK is loaded on
    // first upload, so the local driver never pulls it in.
    let client: S3Client | undefined
    cached = {
      name: "s3",
      async put(key, body, mimeType) {
        if (!MEDIA_KEY.test(key)) throw new Error(`Refusing media key ${key}`)
        const sdk = await import("@aws-sdk/client-s3")
        client ??= new sdk.S3Client(s3Config(env))
        await client.send(
          new sdk.PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: mimeType,
            ContentDisposition: contentDisposition(key),
            CacheControl: CACHE,
          })
        )
      },
      urlFor: (key) => `${base}/${key}`,
    }
  } else {
    cached = {
      name: "local",
      async put(key, body) {
        const file = localFile(key, env.MEDIA_LOCAL_DIR)
        if (!file) throw new Error(`Refusing media key ${key}`)
        await mkdir(path.dirname(file.path), { recursive: true })
        // Temp file in the same directory, then rename: readers see the old
        // file or the whole new one, never a partial write, and a file left
        // by a crashed write is replaced rather than trusted. The temp name
        // never matches MEDIA_KEY, so /uploads cannot serve it.
        const temp = `${file.path}.${randomUUID()}.tmp`
        try {
          await writeFile(temp, body, { flag: "wx" })
          await rename(temp, file.path)
        } catch (error) {
          await rm(temp, { force: true })
          throw error
        }
      },
      urlFor: (key) => `/uploads/${key}`,
    }
  }
  return cached
}

// Tests switch drivers through env.
export function resetStorageForTests() {
  cached = undefined
}
