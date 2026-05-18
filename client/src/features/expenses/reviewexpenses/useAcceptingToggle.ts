import { useState } from "react"

export function useAcceptingToggle(remainingCount: number) {
  const [stillAccepting, setStillAccepting] = useState(true)
  const [switchWarning, setSwitchWarning] = useState<string | null>(null)

  const onSwitchChange = (checked: boolean) => {
    if (!checked && remainingCount > 0) {
      setSwitchWarning(
        `You still have ${String(remainingCount)} item${remainingCount === 1 ? "" : "s"} to review — finish the list before continuing.`,
      )
      return
    }
    setSwitchWarning(null)
    setStillAccepting(checked)
  }

  return { stillAccepting, switchWarning, onSwitchChange }
}
