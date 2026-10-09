"use client"

import {
  ExternalLinkIcon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const DEVICES = { desktop: 1440, tablet: 834, phone: 390 } as const
type Device = keyof typeof DEVICES

// Only a path on this site: the preview endpoint refuses anything else
// (Task 2), and the frame never points at another origin either.
export const previewSrc = (path: string) =>
  `/api/v1/admin/preview?path=${encodeURIComponent(
    /^\/(?![/\\])/.test(path) ? path : "/"
  )}`

// The site in draft mode (Task 2), scaled to the pane. `refreshKey` changes
// after each autosave; a same-origin reload keeps the iframe's scroll.
export function PreviewPane({
  path,
  refreshKey,
  className,
}: {
  path: string
  refreshKey: number | null
  className?: string
}) {
  const [device, setDevice] = useState<Device>("desktop")
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [loading, setLoading] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const width = DEVICES[device]
  const scale = box.width ? Math.min(1, box.width / width) : 1
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setBox({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!refreshKey) return
    const win = frame.current?.contentWindow
    if (!win) return
    setLoading(true)
    win.location.reload()
  }, [refreshKey])
  const src = previewSrc(path)
  return (
    <section
      aria-label="Live preview"
      className={cn(
        "rounded-card flex min-w-0 flex-col gap-4 bg-card p-4 sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-title flex items-center gap-2">
          Preview
          {loading ? (
            <Spinner aria-label="Refreshing" className="size-4 text-primary" />
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          <ToggleGroup
            value={[device]}
            onValueChange={(value) => value[0] && setDevice(value[0] as Device)}
            aria-label="Preview size"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="desktop" aria-label="Desktop">
              <MonitorIcon aria-hidden />
              <span className="hidden 2xl:inline">Desktop</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="tablet" aria-label="Tablet">
              <TabletIcon aria-hidden />
              <span className="hidden 2xl:inline">Tablet</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="phone" aria-label="Phone">
              <SmartphoneIcon aria-hidden />
              <span className="hidden 2xl:inline">Phone</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <a
            href={src}
            target="_blank"
            rel="noopener"
            aria-label="Open the preview in a new tab"
            className="flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ExternalLinkIcon aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <div
        ref={boxRef}
        className="relative min-h-[28rem] flex-1 overflow-hidden rounded-xl bg-muted"
      >
        <iframe
          ref={frame}
          title="Page preview"
          src={src}
          onLoad={() => setLoading(false)}
          className={cn(
            "absolute top-0 border-0 bg-white transition-opacity",
            box.width === 0 && "opacity-0",
            scale === 1 && device !== "desktop" && "shadow-lg"
          )}
          style={{
            width,
            height: box.height ? box.height / scale : "100%",
            left: Math.max(0, (box.width - width * scale) / 2),
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </section>
  )
}
