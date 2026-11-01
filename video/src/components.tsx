import React from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import { C, FADE, FONT_SANS } from "./theme"

const ease = Easing.bezier(0.22, 1, 0.36, 1)

// Length of the scene a component sits in (set by MainVideo for each Sequence).
export const SceneDuration = React.createContext(0)
export const useSceneDuration = () => React.useContext(SceneDuration)

// Fades a scene in over its first FADE frames and out over its last FADE.
export const SceneFade: React.FC<{
  children: React.ReactNode
  fadeIn?: boolean
  fadeOut?: boolean
  background?: string
}> = ({ children, fadeIn = true, fadeOut = true, background }) => {
  const frame = useCurrentFrame()
  const durationInFrames = useSceneDuration()
  const opIn = fadeIn
    ? interpolate(frame, [0, FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1
  const opOut = fadeOut
    ? interpolate(frame, [durationInFrames - FADE, durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1
  return <AbsoluteFill style={{ opacity: Math.min(opIn, opOut), background }}>{children}</AbsoluteFill>
}

// Rises and fades in, starting at `delay` frames.
export const Rise: React.FC<{
  children: React.ReactNode
  delay?: number
  distance?: number
  duration?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, distance = 40, duration = 24, style }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  })
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * distance}px)`, ...style }}>
      {children}
    </div>
  )
}

// A line of text revealed from behind a mask.
export const MaskLine: React.FC<{
  children: React.ReactNode
  delay?: number
  duration?: number
  style?: React.CSSProperties
}> = ({ children, delay = 0, duration = 26, style }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  })
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 2) }}>{children}</div>
    </div>
  )
}

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; dot?: string }> = ({
  children,
  color = C.brand,
  dot = C.clay,
}) => (
  <div
    style={{
      fontFamily: FONT_SANS,
      fontSize: 22,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color,
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}
  >
    <span style={{ width: 10, height: 10, borderRadius: 5, background: dot, display: "inline-block" }} />
    {children}
  </div>
)

// Full-bleed photo with a slow push-in.
export const KenBurns: React.FC<{
  src: string
  from?: number
  to?: number
  position?: string
  style?: React.CSSProperties
}> = ({ src, from = 1.12, to = 1, position = "center", style }) => {
  const frame = useCurrentFrame()
  const durationInFrames = useSceneDuration()
  const s = interpolate(frame, [0, durationInFrames], [from, to], { extrapolateRight: "clamp" })
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: position,
        transform: `scale(${s})`,
        ...style,
      }}
    />
  )
}

export const usePop = (delay: number, damping = 14) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 120, mass: 1 } })
}
