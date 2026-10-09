// Destructive helpers must never run against a development or production DB.
export function assertDisposableDatabase(url: string) {
  const name = new URL(url).pathname.replace(/^\//, "")
  if (!/_(test|e2e)$/.test(name)) {
    throw new Error(
      `Refusing destructive database operation on "${name}": name must end with _test or _e2e`
    )
  }
}
