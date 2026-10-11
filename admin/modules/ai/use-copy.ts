// admin/modules/ai/use-copy.ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

// Copy to the clipboard and say so on the button for two seconds.
export function useCopy(resetMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = useCallback(
    (text: string) =>
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), resetMs)
        },
        () => void toast.error("Couldn't copy. Select the text and copy it.")
      ),
    [resetMs]
  )
  return { copied, copy }
}
