import type { ReactNode } from "react"
import {
  Badge,
  Card,
  Divider,
  Heading,
} from "@digdir/designsystemet-react"

type Props = {
  title: string
  count: number
  content: ReactNode
  footer: ReactNode
}

export default function StatCard({ title, count, content, footer }: Props) {
  return (
    <Card asChild>
      <section style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Card.Block style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <Heading level={4} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <span>{title}</span>
            <Badge count={count} />
          </Heading>
          <Divider />
          {content}
          {footer}
        </Card.Block>
      </section>
    </Card>
  )
}
