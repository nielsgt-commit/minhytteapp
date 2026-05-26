import type { ReactNode } from "react"
import { Badge, Card, Divider, Heading } from "@digdir/designsystemet-react"
import styles from "./PropertyStats.module.css"

type Props = {
  title: string
  count: number
  content: ReactNode
  footer: ReactNode
}

export default function StatCard({ title, count, content, footer }: Props) {
  return (
    <Card asChild>
      <section className={styles.card}>
        <Card.Block className={styles.cardBlock}>
          <Heading level={4} className={styles.cardHeading}>
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
