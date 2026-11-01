import React from "react"
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion"

import { MaskLine, Rise, SceneFade, useSceneDuration } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

export const Problem: React.FC = () => {
  const frame = useCurrentFrame()
  const durationInFrames = useSceneDuration()
  const { quote, follow } = CONTENT.problem
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.04])
  const rule = interpolate(frame, [120, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  })

  return (
    <SceneFade background={C.cream}>
      {/* soft brand glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 85% 15%, ${C.mint} 0%, transparent 45%), radial-gradient(circle at 10% 95%, rgba(176,81,63,0.10) 0%, transparent 40%)`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${drift})` }}>
        <Rise delay={10} distance={20}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 220, lineHeight: 0.6, color: C.clay, textAlign: "center" }}>
            “
          </div>
        </Rise>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 84,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            color: C.pine,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          {quote.map((line, i) => (
            <MaskLine key={i} delay={24 + i * 22} duration={30}>
              {line}
            </MaskLine>
          ))}
        </div>
        <div
          style={{
            width: 160,
            height: 2,
            background: C.clay,
            margin: "56px 0 44px",
            transform: `scaleX(${rule})`,
          }}
        />
        <Rise delay={150}>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 32,
              lineHeight: 1.5,
              color: C.muted,
              textAlign: "center",
              maxWidth: 1080,
            }}
          >
            {follow}
          </div>
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
