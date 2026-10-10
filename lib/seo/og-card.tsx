// Shared by the /og route (ImageResponse) and the admin share preview (DOM).
// No server-only imports.
export type OgSubject = { title: string; eyebrow: string; siteName: string }
export type OgColors = { background: string; text: string; accent: string }

// Flexbox only (ImageResponse/Satori). Ruling R8: the logo is a wordmark.
export function OgCard({
  title,
  eyebrow,
  siteName,
  colors,
}: OgSubject & { colors: OgColors }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: colors.background,
        color: colors.text,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: colors.accent,
          letterSpacing: 1,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Fraunces",
          fontSize: title.length > 60 ? 64 : 80,
          lineHeight: 1.08,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 30,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: colors.accent,
          }}
        />
        {siteName}
      </div>
    </div>
  )
}
