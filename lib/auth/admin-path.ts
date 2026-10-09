// Request header the proxy sets on every /admin request with the path being
// requested, so layouts (which never receive the pathname) can send a signed
// out visitor back to the same page. The proxy always overwrites it, and the
// value is passed through safeNext before use.
export const ADMIN_PATH_HEADER = "x-mk-admin-path"
