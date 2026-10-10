import { gunzipSync } from "node:zlib"

export const unwrap = (buf: Buffer) =>
  buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf

export const dumpFormat = (buf: Buffer): "custom" | "plain" =>
  buf.subarray(0, 5).toString("latin1") === "PGDMP" ? "custom" : "plain"

export function pickLatest(
  objects: { Key?: string; LastModified?: Date }[]
): string | null {
  const keyed = objects.filter((o): o is { Key: string; LastModified?: Date } =>
    Boolean(o.Key)
  )
  keyed.sort(
    (a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)
  )
  return keyed[0]?.Key ?? null
}

// The drill drops and recreates its database: never let it touch a real one.
// The name is also interpolated into SQL, so it must be a plain identifier.
export function assertDrillDatabase(url: string) {
  const name = new URL(url).pathname.replace(/^\//, "")
  if (!name.endsWith("_restore_drill") || !/^[a-z0-9_]+$/.test(name)) {
    throw new Error(
      `Refusing to restore into "${name}": the drill database name must be lowercase letters, digits or _ and end in _restore_drill`
    )
  }
  return name
}
