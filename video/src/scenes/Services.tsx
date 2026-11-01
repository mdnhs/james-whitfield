import React from "react"
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion"

import { Eyebrow, MaskLine, Rise, SceneFade, usePop, useSceneDuration } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

const Card: React.FC<{ icon: string; title: string; body: string; delay: number }> = ({ icon, title, body, delay }) => {
  const p = usePop(delay, 16)
  return (
    <div
      style={{
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 60}px)`,
        background: "rgba(250,246,240,0.06)",
        border: "1px solid rgba(214,232,228,0.16)",
        borderRadius: 28,
        padding: "34px 36px",
        height: 220,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: C.mint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img src={staticFile(`images/icon-${icon}.svg`)} style={{ width: 30, height: 30 }} />
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 34, color: C.cream, marginTop: 24 }}>{title}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 22, color: "rgba(250,246,240,0.68)", marginTop: 8 }}>{body}</div>
    </div>
  )
}

export const Services: React.FC = () => {
  const frame = useCurrentFrame()
  const durationInFrames = useSceneDuration()
  const { eyebrow, title, items, formats } = CONTENT.services
  const glow = interpolate(frame, [0, durationInFrames], [0, 30])

  return (
    <SceneFade background={C.spruce}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${70 + glow * 0.3}% ${10 + glow * 0.4}%, rgba(51,96,96,0.65) 0%, transparent 50%)`,
        }}
      />
      <AbsoluteFill style={{ padding: "100px 140px" }}>
        <Rise delay={6}>
          <Eyebrow color={C.mint}>{eyebrow}</Eyebrow>
        </Rise>
        <MaskLine
          delay={14}
          style={{
            marginTop: 20,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 76,
            color: C.cream,
            letterSpacing: "-0.015em",
          }}
        >
          {title}
        </MaskLine>
        <div
          style={{
            marginTop: 60,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 26,
          }}
        >
          {items.map((s, i) => (
            <Card key={s.title} {...s} delay={40 + i * 10} />
          ))}
        </div>
        <Rise delay={190} style={{ marginTop: 56 }}>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 28,
              color: C.mint,
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <span style={{ width: 40, height: 2, background: C.clay, display: "inline-block" }} />
            {formats}
          </div>
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
