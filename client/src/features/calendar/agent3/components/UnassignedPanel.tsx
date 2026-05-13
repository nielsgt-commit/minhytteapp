import { Card, Field, Label, Tag } from "@digdir/designsystemet-react"
import type { PreviewConflicts } from "@/features/calendar/booking-logic"

export function UnassignedPanel({
  occupants,
  conflicts,
  onQueue,
}: {
  occupants: { user_id: number; queued: boolean }[]
  conflicts: PreviewConflicts | undefined
  onQueue: (userId: number, queued: boolean) => void
}) {
  const isOverCap = (conflicts?.property.overCapacityBy ?? 0) > 0
  const allQueued = occupants.length > 0 && occupants.every(o => o.queued)

  // Card's data-color type is narrower than Tag's; cast to allow feedback colors
  const cardColor = (isOverCap ? "warning" : "neutral") as "neutral"
  return (
    <Card data-color={cardColor}>
      <Card.Block>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label data-size="sm">Unassigned</Label>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Field>
              <Label data-size="sm">
                <input
                  type="checkbox"
                  checked={allQueued}
                  disabled={occupants.length === 0}
                  onChange={e => {
                    for (const o of occupants) onQueue(o.user_id, e.target.checked)
                  }}
                />
                {" "}Queue
              </Label>
            </Field>
            <Tag data-color={isOverCap ? "warning" : "neutral"}>{occupants.length}</Tag>
          </div>
        </div>
      </Card.Block>
    </Card>
  )
}
