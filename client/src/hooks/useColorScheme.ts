import { useCallback, useEffect, useState } from "react"

export type ColorScheme = "light" | "dark"

const STORAGE_KEY = "color-scheme"

function readInitial(): ColorScheme {
  const fromDom = document.documentElement.dataset.colorScheme
  if (fromDom === "light" || fromDom === "dark") return fromDom
  return "light"
}

function apply(scheme: ColorScheme) {
  document.documentElement.dataset.colorScheme = scheme
  try {
    localStorage.setItem(STORAGE_KEY, scheme)
  } catch {
    // localStorage unavailable (private mode, etc.) — ignore
  }
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>(readInitial)

  useEffect(() => {
    apply(scheme)
  }, [scheme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue === "light" || e.newValue === "dark") {
        setScheme(e.newValue)
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const toggle = useCallback(() => {
    setScheme(prev => (prev === "dark" ? "light" : "dark"))
  }, [])

  return { scheme, toggle }
}
