import { apiErrorFrom } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"

import type { MediaItem } from "./queries"

const TOO_LARGE = "That file is over 20 MB. Choose a smaller one."
const WRONG_TYPE = "Upload a JPEG, PNG, WebP, AVIF or PDF file."
const BUSY = "The server is busy processing other uploads. Try again shortly."

// fetch() has no upload progress; XMLHttpRequest does. Same origin, so the
// session cookie and Origin header (sameOrigin) come with it.
export function uploadFile(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
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
    xhr.onerror = () =>
      reject(
        new ApiError(
          "NETWORK",
          "Couldn't reach the server. Check your connection and try again.",
          0
        )
      )
    const form = new FormData()
    form.set("file", file)
    xhr.send(form)
  })
}
