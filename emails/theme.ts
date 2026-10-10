import type { CSSProperties } from "react"

// Brand values carried over from the original plain templates. The site
// palette names appear in copy only (e.g. "sage"); emails use flat hex values
// because most mail clients ignore CSS variables.
export const theme = {
  canvas: "#f2f3f2",
  card: "#ffffff",
  ink: "#111411",
  muted: "#5b625b",
  accent: "#16823a",
  radius: 16,
  font: "Arial, Helvetica, sans-serif",
  palette: { canvas: "mist", card: "white", ink: "charcoal", accent: "green" },
  body: {
    margin: 0,
    padding: "24px",
    backgroundColor: "#f2f3f2",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#111411",
  } satisfies CSSProperties,
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "32px",
  } satisfies CSSProperties,
  heading: {
    margin: "0 0 16px",
    fontSize: "20px",
    color: "#111411",
  } satisfies CSSProperties,
  button: {
    display: "inline-block",
    backgroundColor: "#16823a",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "12px",
    textDecoration: "none",
  } satisfies CSSProperties,
  footer: {
    marginTop: "16px",
    fontSize: "12px",
    color: "#5b625b",
  } satisfies CSSProperties,
}
