import React from "react"
import { AbsoluteFill, Img, staticFile } from "remotion"

import { KenBurns, MaskLine, Rise, SceneFade, usePop } from "../components"
import { CONTENT } from "../content"
import { C, FONT_DISPLAY, FONT_SANS } from "../theme"

export const Cta: React.FC = () => {
  const { headline, sub, button, footer } = CONTENT.cta
  const btn = usePop(95, 12)

  return (
    <SceneFade background={C.spruce} fadeOut={false}>
      <KenBurns src="images/step-4.jpg" from={1.15} to={1.0} position="center 45%" />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,38,32,0.72) 0%, rgba(0,38,32,0.82) 60%, rgba(0,38,32,0.94) 100%)" }} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <Rise delay={8} distance={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                background: C.cream,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img src={staticFile("images/logo-mark.svg")} style={{ width: 34, height: 34 }} />
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 36, color: C.cream }}>{CONTENT.name}</div>
          </div>
        </Rise>

        <div
          style={{
            marginTop: 54,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 112,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: C.cream,
          }}
        >
          {headline.map((l, i) => (
            <MaskLine key={i} delay={24 + i * 14} duration={30}>
              {i === 1 ? <span style={{ color: C.mint }}>{l}</span> : l}
            </MaskLine>
          ))}
        </div>

        <Rise delay={70} style={{ marginTop: 34 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 32, color: "rgba(250,246,240,0.82)" }}>{sub}</div>
        </Rise>

        <div
          style={{
            marginTop: 56,
            transform: `scale(${0.8 + btn * 0.2})`,
            opacity: Math.min(1, btn * 1.5),
            background: C.clay,
            color: C.cream,
            fontFamily: FONT_SANS,
            fontSize: 32,
            padding: "28px 56px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 18,
            boxShadow: "0 24px 50px -20px rgba(176,81,63,0.8)",
          }}
        >
          {button}
          <span style={{ fontSize: 34 }}>→</span>
        </div>

        <Rise delay={130} style={{ position: "absolute", bottom: 80 }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 24, letterSpacing: "0.04em", color: "rgba(214,232,228,0.8)" }}>
            {footer}
          </div>
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
