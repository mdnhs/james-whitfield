// Ruling R14: the only hosts a custom snippet's `src` may use. The CSP
// (lib/tracking/csp.ts, read by next.config.ts at build) uses the same list,
// so adding a host is a code change and a deploy. Hostnames only, no scheme.
export const CUSTOM_SCRIPT_HOSTS: readonly string[] = []
