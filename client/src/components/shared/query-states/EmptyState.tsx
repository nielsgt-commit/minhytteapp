import { Paragraph } from "@digdir/designsystemet-react"
import type { ReactNode } from "react"

type Props = {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: Props) {
  return (
    <>
      <Paragraph>{title}</Paragraph>
      {children}
    </>
  )
}
