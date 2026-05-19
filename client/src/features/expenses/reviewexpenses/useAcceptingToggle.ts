import { useState } from "react"

export function useAcceptingToggle(remainingCount: number) {
  const [stillAccepting, setStillAccepting] = useState(true)
  const [warningCount, setWarningCount] = useState<number | null>(null)

  const onSwitchChange = (checked: boolean) => {
    if (!checked && remainingCount > 0) {
      setWarningCount(remainingCount)
      return
    }
    setWarningCount(null)
    setStillAccepting(checked)
  }

  return { stillAccepting, warningCount, onSwitchChange }
}
