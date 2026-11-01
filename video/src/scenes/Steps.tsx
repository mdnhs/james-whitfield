import React from "react"
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion"

import { Eyebrow, MaskLine, Rise, SceneFade } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

const ease = Easing.bezier(0.22, 1, 0.36, 1)
const START = 40 // first step appears
const STEP = 100 // frames per step
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

export const Steps: React.FC = () => {
  const frame = useCurrentFrame()
  const { eyebrow, title, items } = CONTENT.steps
  const last = items.length - 1

  return (
    <SceneFade background={C.cream}>
      <AbsoluteFill style={{ padding: "110px 140px 0" }}>
        <Rise delay={4}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Rise>
        <MaskLine
          delay={10}
          style={{
            marginTop: 20,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 64,
            color: C.spruce,
            letterSpacing: "-0.015em",
          }}
        >
          {title}
        </MaskLine>
      </AbsoluteFill>

      {/* step copy */}
      {items.map((s, i) => {
        const t0 = START + i * STEP
        const pin = interpolate(frame, [t0, t0 + 22], [0, 1], { ...clamp, easing: ease })
        const pout = i === last ? 0 : interpolate(frame, [t0 + STEP - 14, t0 + STEP], [0, 1], { ...clamp, easing: ease })
        const op = pin * (1 - pout)
        if (op <= 0) return null
        return (
          <div
            key={s.title}
            style={{
              position: "absolute",
              left: 140,
              top: 380,
              width: 720,
              opacity: op,
              transform: `translateY(${(1 - pin) * 50 - pout * 50}px)`,
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 150, lineHeight: 1, color: "rgba(176,81,63,0.9)" }}>
              0{i + 1}
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 68,
                color: C.pine,
                marginTop: 18,
                letterSpacing: "-0.015em",
              }}
            >
              {s.title}
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 30, lineHeight: 1.5, color: C.muted, marginTop: 20 }}>
              {s.body}
            </div>
          </div>
        )
      })}

      {/* image stack */}
      <div
        style={{
          position: "absolute",
          right: 140,
          top: 150,
          width: 840,
          height: 700,
          borderRadius: 32,
          overflow: "hidden",
          background: C.mint,
          clipPath: `inset(${interpolate(frame, [20, 55], [100, 0], { ...clamp, easing: ease })}% 0 0 0 round 32px)`,
        }}
      >
        {items.map((s, i) => {
          const t0 = START + i * STEP
          const op = i === 0 ? 1 : interpolate(frame, [t0 - 10, t0 + 12], [0, 1], clamp)
          const z = interpolate(frame, [t0 - 10, t0 + STEP + 20], [1.12, 1.0], clamp)
          return (
            <Img
              key={s.image}
              src={staticFile(s.image)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: i === 0 ? "center 40%" : "center",
                opacity: op,
                transform: `scale(${z})`,
              }}
            />
          )
        })}
      </div>

      {/* progress rail */}
      <div style={{ position: "absolute", left: 140, right: 140, bottom: 90, display: "flex", gap: 24 }}>
        {items.map((s, i) => {
          const t0 = START + i * STEP
          const fill = interpolate(frame, [t0, t0 + STEP], [0, 1], clamp)
          const active = frame >= t0 && (i === last || frame < t0 + STEP)
          return (
            <div key={s.title} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 2, background: C.line, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${fill * 100}%`, background: C.pine }} />
              </div>
              <div
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 20,
                  marginTop: 14,
                  color: active ? C.pine : C.subtle,
                  opacity: active ? 1 : 0.7,
                }}
              >
                0{i + 1} · {s.title}
              </div>
            </div>
          )
        })}
      </div>
    </SceneFade>
  )
}
