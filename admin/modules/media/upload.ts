import { apiErrorFrom } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"

import type { MediaItem } from "./queries"

const TOO_LARGE = "That file is over 20 MB. Choose a smaller one."
const WRONG_TYPE = "Upload a JPEG, PNG, WebP, AVIF or PDF file."
const BUSY = "The server is busy processing other uploads. Try again shortly."

// Mirrors server/lib/media (MAX_UPLOAD_BYTES, sniff.ts); that code is
// server-only, so the limits are repeated here for an early, byteless refusal.
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
] as const
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
}

// A message when the server would refuse the file anyway, else null.
export function checkFile(file: File): string | null {
  const type =
    file.type ||
    EXTENSION_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] ||
    ""
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) return WRONG_TYPE
  if (file.size > MAX_UPLOAD_BYTES) return TOO_LARGE
  return null
}

// fetch() has no upload progress; XMLHttpRequest does. Same origin, so the
// session cookie and Origin header (sameOrigin) come with it.
export function uploadFile(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const refusal = checkFile(file)
    if (refusal) {
      reject(
        new ApiError(
          file.size > MAX_UPLOAD_BYTES
            ? "PAYLOAD_TOO_LARGE"
            : "VALIDATION_FAILED",
          refusal,
          0
        )
      )
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    const network = () =>
      reject(
        new ApiError(
          "NETWORK",
          "Couldn't reach the server. Check your connection and try again.",
          0
        )
      )
    xhr.onload = () => {
      if (xhr.status === 0) return network()
      if (xhr.status >= 200 && xhr.status < 300)
        return resolve(xhr.response as MediaItem)
      const error = apiErrorFrom(xhr.status, xhr.response)
      // Proxies answer 413/415/503 without our envelope; say what it means.
      const enveloped = Boolean(
        (xhr.response as { error?: unknown } | null)?.error
      )
      const plain = enveloped
        ? null
        : xhr.status === 413
          ? TOO_LARGE
          : xhr.status === 415
            ? WRONG_TYPE
            : xhr.status === 503
              ? BUSY
              : null
      reject(
        plain
          ? new ApiError(error.code, plain, xhr.status, error.requestId)
          : error
      )
    }
    xhr.onerror = network
    xhr.onabort = network
    xhr.ontimeout = network
    const form = new FormData()
    form.set("file", file)
    xhr.send(form)
  })
}
