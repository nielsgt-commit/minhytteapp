import { useState } from "react"
import { Button, Card, Heading } from "@digdir/designsystemet-react"
import { MaintenanceHistory } from "@/features/maintenance/MaintenanceHistory.tsx"
import { MaintenanceTodos } from "@/features/maintenance/MaintenanceTodos.tsx"

export type MaintenanceScope =
  | { kind: "building"; id: number; name: string }
  | { kind: "place"; id: number; name: string }

export function MaintenanceCard({ scope }: { scope: MaintenanceScope }) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={4} data-size="xs">{scope.name}</Heading>
        </Card.Block>
        <Card.Block>
          <MaintenanceTodos scope={scope} />
        </Card.Block>
        <Card.Block>
          <Button
            variant="tertiary"
            onClick={() => { setShowHistory(v => !v) }}
          >
            {showHistory ? "Hide history" : "Show history"}
          </Button>
          {showHistory && <MaintenanceHistory scope={scope} />}
        </Card.Block>
      </section>
    </Card>
  )
}
