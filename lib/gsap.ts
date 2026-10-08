"use client"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)
// Mobile URL-bar show/hide resizes the viewport; refreshing every trigger then
// makes the page jump mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true })
export { gsap, ScrollTrigger, SplitText, useGSAP }
