import { Button, Heading, Paragraph } from "@digdir/designsystemet-react"
import type { BookingDraft, PreviewConflicts } from "@/features/calendar/booking-logic"

export function ConfirmStep({
  conflicts,
  draft,
  onConfirm,
  onCancel,
  isMutating,
}: {
  conflicts: PreviewConflicts
  draft: BookingDraft
  onConfirm: (d: BookingDraft) => void
  onCancel: () => void
  isMutating: boolean
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

      {conflicts.perRoom.map(r => (
        <div key={r.room_id}>
          {r.overCapacityBy > 0 && (
            <Paragraph>
              Room &quot;{r.room_name}&quot; over capacity by {r.overCapacityBy}.
            </Paragraph>
          )}
          {r.adultInKidOnlyUserIds.length > 0 && (
            <Paragraph data-color="danger">
              Adult assigned to &quot;{r.room_name}&quot; where only kid-only beds remain.
            </Paragraph>
          )}
        </div>
      ))}

      {conflicts.overlappingBookings.map(ob => (
        <Paragraph key={ob.booking_id}>
          Overlap with {ob.booker_name}: {ob.sharedDays} shared day(s).
          {ob.sameUserOccupants.length > 0
            ? ` Same person: ${ob.sameUserOccupants.map(u => u.user_name).join(", ")}.`
            : ""}
        </Paragraph>
      ))}

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
