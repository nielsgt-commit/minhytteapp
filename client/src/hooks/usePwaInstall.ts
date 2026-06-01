import { useEffect, useState } from "react"

type Platform = "ios" | "android" | "other"

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS 13+ reports as "Macintosh" but has touch support.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (isIos) return "ios"
  if (/Android/.test(ua)) return "android"
  return "other"
}

function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function usePwaInstall() {
  const [platform] = useState<Platform>(detectPlatform)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)")
    const onChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches)
    }
    mq.addEventListener("change", onChange)
    return () => {
      mq.removeEventListener("change", onChange)
    }
  }, [])

  return { platform, isStandalone }
}
