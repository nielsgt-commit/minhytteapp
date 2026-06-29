import { useEffect, useState } from "react"

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }
    setMatches(mq.matches)
    mq.addEventListener("change", onChange)
    return () => {
      mq.removeEventListener("change", onChange)
    }
  }, [query])
  return matches
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 640px)")
}
