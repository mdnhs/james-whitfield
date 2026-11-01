import React, { useEffect, useState } from "react"
import { AbsoluteFill, Sequence, continueRender, delayRender, staticFile } from "remotion"

import { Cta } from "./scenes/Cta"
import { Hook } from "./scenes/Hook"
import { Meet } from "./scenes/Meet"
import { Problem } from "./scenes/Problem"
import { Services } from "./scenes/Services"
import { Steps } from "./scenes/Steps"
import { SceneDuration } from "./components"
import { C, SCENES } from "./theme"

// Load the site's own fonts before any frame is captured.
const useBrandFonts = () => {
  const [handle] = useState(() => delayRender("Loading fonts"))
  useEffect(() => {
    const faces = [
      new FontFace("Fraunces", `url(${staticFile("fonts/Fraunces-SemiBold.ttf")})`, { weight: "600" }),
      new FontFace("Inter", `url(${staticFile("fonts/Inter-Regular.ttf")})`, { weight: "400" }),
    ]
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f))
        continueRender(handle)
      })
      .catch((err) => {
        console.error(err)
        continueRender(handle)
      })
  }, [handle])
}

export const MainVideo: React.FC = () => {
  useBrandFonts()
  return (
    <AbsoluteFill style={{ background: C.heroBase }}>
      {/* padded AbsoluteFills must not grow past the frame */}
      <style>{`*, *::before, *::after { box-sizing: border-box; }`}</style>
      <Sequence from={SCENES.hook.from} durationInFrames={SCENES.hook.duration} name="Hook">
        <SceneDuration.Provider value={SCENES.hook.duration}>
          <Hook />
        </SceneDuration.Provider>
      </Sequence>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration} name="Problem">
        <SceneDuration.Provider value={SCENES.problem.duration}>
          <Problem />
        </SceneDuration.Provider>
      </Sequence>
      <Sequence from={SCENES.meet.from} durationInFrames={SCENES.meet.duration} name="Meet">
        <SceneDuration.Provider value={SCENES.meet.duration}>
          <Meet />
        </SceneDuration.Provider>
      </Sequence>
      <Sequence from={SCENES.steps.from} durationInFrames={SCENES.steps.duration} name="How it works">
        <SceneDuration.Provider value={SCENES.steps.duration}>
          <Steps />
        </SceneDuration.Provider>
      </Sequence>
      <Sequence from={SCENES.services.from} durationInFrames={SCENES.services.duration} name="Services">
        <SceneDuration.Provider value={SCENES.services.duration}>
          <Services />
        </SceneDuration.Provider>
      </Sequence>
      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration} name="CTA">
        <SceneDuration.Provider value={SCENES.cta.duration}>
          <Cta />
        </SceneDuration.Provider>
      </Sequence>
    </AbsoluteFill>
  )
}
