import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import { groupConsecutive } from "@/features/calendar/booking-logic"
import type { BookingDraft, PreviewConflicts } from "@/features/calendar/booking-logic"

function formatDateRanges(isos: string[]): string {
  return groupConsecutive(isos)
    .map(r => (r.start === r.end ? r.start : `${r.start} – ${r.end}`))
    .join(", ")
}

export function ConfirmStep({
  conflicts,
  draft,
  onConfirm,
  onCancel,
  isMutating,
  roomOverCapacityDays,
}: {
  conflicts: PreviewConflicts
  draft: BookingDraft
  onConfirm: (d: BookingDraft) => void
  onCancel: () => void
  isMutating: boolean
  roomOverCapacityDays: Map<number, string[]>
}) {
  const overflowIds = new Set<number>()
  for (const r of conflicts.perRoom) {
    for (const uid of r.adultInKidOnlyUserIds) overflowIds.add(uid)
  }
  if (conflicts.property.overCapacityBy > 0) {
    let rem = conflicts.property.overCapacityBy
    for (const o of [...draft.occupants.filter(x => x.room_id == null)].reverse()) {
      if (rem <= 0) break
      overflowIds.add(o.user_id)
      rem--
    }
  }

  return (
    <div
      style={{
        border: "2px solid #dc3545",
        borderRadius: "8px",
        padding: "1rem",
        background: "#fff5f5",
        marginTop: "1rem",
      }}
    >
      <Heading level={5}>Warnings — confirm to proceed</Heading>

      {conflicts.property.overCapacityBy > 0 && (
        <Paragraph>
          Property over capacity by {conflicts.property.overCapacityBy} person(s).
        </Paragraph>
      )}

      {conflicts.perRoom.map(r => {
        const days = roomOverCapacityDays.get(r.room_id) ?? []
        return (
          <div key={r.room_id}>
            {r.overCapacityBy > 0 && days.length > 0 && (
              <Paragraph>
                Room &quot;{r.room_name}&quot; over capacity by {r.overCapacityBy} on {formatDateRanges(days)}.
              </Paragraph>
            )}
            {r.adultInKidOnlyUserIds.length > 0 && (
              <Paragraph data-color="danger">
                Adult assigned to &quot;{r.room_name}&quot; where only kid-only beds remain.
              </Paragraph>
            )}
          </div>
        )
      })}

      {overflowIds.size > 0 && (
        <Paragraph style={{ marginTop: "0.5rem" }}>
          {overflowIds.size} occupant(s) will be marked queued on submit.
        </Paragraph>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <Button
          onClick={() => {
            onConfirm({
              ...draft,
              occupants: draft.occupants.map(o => ({
                ...o,
                queued: overflowIds.has(o.user_id) ? true : o.queued,
              })),
            })
          }}
          disabled={isMutating}
        >
          Request anyway
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isMutating}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
