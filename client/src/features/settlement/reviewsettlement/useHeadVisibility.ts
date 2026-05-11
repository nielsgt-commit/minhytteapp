import { useState } from "react"

export function useHeadVisibility() {
  const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set())
  const toggle = (id: number) => {
    setVisibleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return { visibleIds, toggle }
}
