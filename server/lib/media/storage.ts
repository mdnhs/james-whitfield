import "server-only"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

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
    cached = {
      name: "s3",
      // Loaded on first upload, so the local driver never pulls in the SDK.
      async put(key, body, mimeType) {
        if (!MEDIA_KEY.test(key)) throw new Error(`Refusing media key ${key}`)
        const { PutObjectCommand, S3Client } =
          await import("@aws-sdk/client-s3")
        const client = new S3Client(s3Config(env))
        await client.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: mimeType,
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
        // Same key = same bytes (content hash): an existing file is fine.
        await writeFile(file.path, body, { flag: "wx" }).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== "EEXIST") throw error
          }
        )
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
