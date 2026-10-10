// scripts/restore-drill.ts
// docs/runbook.md "Restore a backup" (Ruling R15). Restores a pg_dump into a
// disposable local database and checks it is a working copy of the site.
//   pnpm backup:drill --file backup.dump[.gz] | --file backup.sql[.gz]
//   pnpm backup:drill --latest      (BACKUP_S3_* from your shell, read-only R2 token)
// Needs the local stack (pnpm db:up): psql/pg_restore run in its postgres container.
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { parseArgs } from "node:util"

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"
import pg from "pg"

import {
  assertDrillDatabase,
  dumpFormat,
  pickLatest,
  unwrap,
} from "./restore-drill-lib"

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    latest: { type: "boolean" },
    keep: { type: "boolean" },
  },
})
const url =
  process.env.DRILL_DATABASE_URL ??
  "postgres://mk:mk@localhost:5432/mk_restore_drill"
const db = assertDrillDatabase(url)
const psql = (args: string[], input?: Buffer) => {
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "postgres", ...args],
    { input, stdio: ["pipe", "inherit", "inherit"] }
  )
  if (result.status !== 0)
    throw new Error(`${args[0]} failed (exit ${result.status})`)
}

async function download(): Promise<Buffer> {
  if (values.file) return readFileSync(values.file)
  if (!values.latest) throw new Error("Pass --file <dump> or --latest")
  const env = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
  }
  const s3 = new S3Client({
    endpoint: env("BACKUP_S3_ENDPOINT"),
    region: process.env.BACKUP_S3_REGION ?? "auto",
    credentials: {
      accessKeyId: env("BACKUP_S3_ACCESS_KEY_ID"),
      secretAccessKey: env("BACKUP_S3_SECRET_ACCESS_KEY"),
    },
  })
  const Bucket = env("BACKUP_S3_BUCKET")
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket, Prefix: process.env.BACKUP_S3_PREFIX })
  )
  const Key = pickLatest(listed.Contents ?? [])
  if (!Key) throw new Error("No backups found in the bucket/prefix")
  console.log(`Latest backup: ${Key}`)
  const object = await s3.send(new GetObjectCommand({ Bucket, Key }))
  return Buffer.from(await object.Body!.transformToByteArray())
}

async function verify() {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const journal = JSON.parse(
      readFileSync("server/db/migrations/meta/_journal.json", "utf8")
    ) as { entries: unknown[] }
    const one = async (sql: string) =>
      Number((await client.query(sql)).rows[0].n)
    const checks = {
      migrations:
        (await one(
          "select count(*) as n from drizzle.__drizzle_migrations"
        )) === journal.entries.length,
      owner:
        (await one(
          "select count(*) as n from users where role like '%owner%'"
        )) > 0,
      publishedPages:
        (await one(
          "select count(*) as n from pages where status = 'published'"
        )) > 0,
    }
    for (const table of [
      "users",
      "pages",
      "articles",
      "leads",
      "newsletter_subscribers",
      "media",
      "audit_logs",
    ]) {
      console.log(
        `  ${table}: ${await one(`select count(*) as n from ${table}`)}`
      )
    }
    console.log(checks)
    if (Object.values(checks).some((ok) => !ok))
      throw new Error("Restore drill FAILED")
    console.log("Restore drill PASSED")
  } finally {
    await client.end()
  }
}

const dump = unwrap(await download())
psql([
  "psql",
  "-U",
  "mk",
  "-d",
  "postgres",
  "-c",
  `drop database if exists ${db}`,
  "-c",
  `create database ${db}`,
])
if (dumpFormat(dump) === "custom")
  psql(["pg_restore", "-U", "mk", "-d", db, "--no-owner", "--no-acl"], dump)
else psql(["psql", "-U", "mk", "-d", db, "-v", "ON_ERROR_STOP=1", "-q"], dump)
try {
  await verify()
} finally {
  if (!values.keep)
    psql([
      "psql",
      "-U",
      "mk",
      "-d",
      "postgres",
      "-c",
      `drop database if exists ${db}`,
    ])
}
