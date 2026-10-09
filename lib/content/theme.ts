import { SITE_TOKENS, type GlobalValue } from "./globals"

const HEX = /^#[0-9a-f]{6}$/i

// The published site theme as :root overrides of the @theme tokens. The
// schema already allows only hex, and this string lands in a <style> tag,
// so it is checked again here.
export function themeCss(tokens: GlobalValue<"theme">["site"]) {
  const declarations = SITE_TOKENS.flatMap((name) => {
    const value = tokens[name]
    return value && HEX.test(value) ? [`--color-${name}:${value}`] : []
  })
  return declarations.length ? `:root{${declarations.join(";")}}` : ""
}
