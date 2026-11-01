import React from "react"
import { Composition } from "remotion"

import { MainVideo } from "./MainVideo"
import { DURATION, FPS, HEIGHT, WIDTH } from "./theme"

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Promo"
    component={MainVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
)
