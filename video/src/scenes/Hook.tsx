import React from "react"
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion"

import { Eyebrow, KenBurns, Rise, SceneFade } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

const ease = Easing.bezier(0.22, 1, 0.36, 1)

export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { eyebrow, headline, description } = CONTENT.hook

  return (
    <SceneFade background={C.heroBase}>
      <KenBurns src="images/hero.jpg" from={1.18} to={1.04} position="center 38%" />
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${C.heroBase} 0%, rgba(13,18,15,0.88) 38%, rgba(13,18,15,0.35) 72%, rgba(13,18,15,0.15) 100%)`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 20% 60%, rgba(51,96,96,0.35), transparent 60%)" }} />

      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
        <Rise delay={8}>
          <Eyebrow color={C.mint}>{eyebrow}</Eyebrow>
        </Rise>
        <div
          style={{
            marginTop: 36,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 112,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            color: C.cream,
            maxWidth: 1000,
            display: "flex",
            flexWrap: "wrap",
            columnGap: "0.24em",
          }}
        >
          {headline.map((w, i) => {
            const d = 22 + i * 5
            const p = interpolate(frame - d, [0, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            })
            return (
              <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: "0.1em" }}>
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${(1 - p) * 105}%)`,
                    color: w.muted ? "rgba(214,232,228,0.62)" : C.cream,
                  }}
                >
                  {w.text}
                </span>
              </span>
            )
          })}
        </div>
        <Rise delay={78} style={{ marginTop: 40 }}>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 30,
              lineHeight: 1.5,
              color: "rgba(250,246,240,0.78)",
              maxWidth: 760,
            }}
          >
            {description}
          </div>
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
