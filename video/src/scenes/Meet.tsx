import React from "react"
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion"

import { Eyebrow, MaskLine, Rise, SceneFade, usePop, useSceneDuration } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

const Badge: React.FC<{ title: string; subtitle: string; icon: string; delay: number }> = ({
  title,
  subtitle,
  icon,
  delay,
}) => {
  const p = usePop(delay)
  return (
    <div
      style={{
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + p * 0.06})`,
        background: "#ffffff",
        border: `1px solid ${C.line}`,
        borderRadius: 24,
        padding: "28px 30px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        boxShadow: "0 18px 40px -24px rgba(0,38,32,0.25)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: C.mint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Img src={staticFile(`images/${icon}.svg`)} style={{ width: 32, height: 32, objectFit: "contain" }} />
      </div>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 30, color: C.spruce, lineHeight: 1.15 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 21, color: C.subtle, marginTop: 6 }}>{subtitle}</div>
      </div>
    </div>
  )
}

export const Meet: React.FC = () => {
  const frame = useCurrentFrame()
  const durationInFrames = useSceneDuration()
  const { eyebrow, place, badges } = CONTENT.meet
  const reveal = interpolate(frame, [5, 45], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  })
  const zoom = interpolate(frame, [0, durationInFrames], [1.12, 1.0])

  return (
    <SceneFade background={C.stone}>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 140px", gap: 110 }}>
        <div
          style={{
            width: 560,
            height: 760,
            borderRadius: 32,
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
            clipPath: `inset(${reveal}% 0 0 0 round 32px)`,
          }}
        >
          <Img
            src={staticFile("images/portrait.jpg")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "68% center",
              transform: `scale(${zoom})`,
            }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <Rise delay={20}>
            <Eyebrow>{eyebrow}</Eyebrow>
          </Rise>
          <MaskLine
            delay={30}
            duration={30}
            style={{
              marginTop: 26,
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 104,
              letterSpacing: "-0.02em",
              color: C.pine,
              lineHeight: 1.05,
            }}
          >
            {CONTENT.name}
          </MaskLine>
          <Rise delay={50} style={{ marginTop: 18 }}>
            <div style={{ fontFamily: FONT_SANS, fontSize: 30, color: C.muted }}>
              {CONTENT.title} <span style={{ color: C.clay }}>·</span> {place}
            </div>
          </Rise>
          <div
            style={{
              marginTop: 56,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
            }}
          >
            {badges.map((b, i) => (
              <Badge key={b.title} {...b} delay={80 + i * 12} />
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  )
}
