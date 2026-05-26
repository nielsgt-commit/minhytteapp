import { useCallback, useState } from "react"

export type ToggleState = {
  value: boolean
  open: () => void
  close: () => void
  toggle: () => void
  setValue: (next: boolean) => void
}

export function useToggleState(initial = false): ToggleState {
  const [value, setValue] = useState(initial)

  const open = useCallback(() => { setValue(true) }, [])
  const close = useCallback(() => { setValue(false) }, [])
  const toggle = useCallback(() => { setValue(v => !v) }, [])

  return { value, open, close, toggle, setValue }
}
