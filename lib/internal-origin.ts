// The server talking to itself over loopback (scheduler tick, redirect
// resolver), never through the public proxy. Read at call time: no secrets.
export const internalOrigin = () =>
  process.env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`
