import { Button } from "@digdir/designsystemet-react"
import { useFormStatus } from "react-dom"
import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  disabled?: boolean
}

export function SubmitButton({ children, disabled = false }: Props) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {children}
    </Button>
  )
}
