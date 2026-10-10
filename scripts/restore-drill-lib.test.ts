import { gzipSync } from "node:zlib"

import { describe, expect, it } from "vitest"

import {
  assertDrillDatabase,
  dumpFormat,
  pickLatest,
  unwrap,
} from "./restore-drill-lib"

describe("restore drill helpers (Ruling R15)", () => {
  it("tells pg_dump's custom format from plain SQL, gzipped or not", () => {
    const custom = Buffer.from("PGDMP\x01\x0e\x00")
    const plain = Buffer.from("--\n-- PostgreSQL database dump\n")
    expect(dumpFormat(unwrap(custom))).toBe("custom")
    expect(dumpFormat(unwrap(gzipSync(custom)))).toBe("custom")
    expect(dumpFormat(unwrap(plain))).toBe("plain")
    expect(dumpFormat(unwrap(gzipSync(plain)))).toBe("plain")
  })

  it("picks the newest object", () => {
    expect(
      pickLatest([
        { Key: "a.dump", LastModified: new Date("2026-10-01") },
        { Key: "c.dump", LastModified: new Date("2026-10-03") },
        { Key: "b.dump", LastModified: new Date("2026-10-02") },
        { LastModified: new Date("2026-10-09") },
      ])
    ).toBe("c.dump")
    expect(pickLatest([])).toBeNull()
  })

  it("only ever restores into a *_restore_drill database", () => {
    expect(
      assertDrillDatabase("postgres://mk:mk@localhost:5432/mk_restore_drill")
    ).toBe("mk_restore_drill")
    expect(() =>
      assertDrillDatabase("postgres://mk:mk@localhost:5432/mk_dev")
    ).toThrow(/_restore_drill/)
    expect(() =>
      assertDrillDatabase("postgres://mk:mk@localhost:5432/")
    ).toThrow(/_restore_drill/)
    expect(() =>
      assertDrillDatabase(
        "postgres://mk:mk@localhost:5432/x;drop_restore_drill"
      )
    ).toThrow()
    expect(() => assertDrillDatabase("not a url")).toThrow()
  })
})
