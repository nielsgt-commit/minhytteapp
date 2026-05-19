import type { Dispatch } from "react"
import { Button, Field, Heading, Label, Paragraph, Select, Textfield } from "@digdir/designsystemet-react"
import { setNotes, setStatus } from "@/features/calendar/booking-logic"
import type { BookingDraft, BookingDraftAction, PreviewConflicts } from "@/features/calendar/booking-logic"
import { ConfirmStep } from "./ConfirmStep"
import type { SubmitAction, SubmitState } from "../hooks/useBookingForm"
import { RoomShape } from "@/features/calendar/types.ts"

type User = { id: number; name: string; is_child: boolean | null }
type Structure = { id: number; name: string }
type DraftOccupant = { user_id: number; queued: boolean }

export function StepConfirm({
  isActive,
  draft,
  dispatch,
  users,
  propertyStructures,
  propertyRooms,
  occupantsByRoom,
  unassigned,
  conflicts,
  submitState,
  submit,
  hasWarnings,
  canSubmit,
  isPending,
  roomOverCapacityDays,
  stepClass,
  stepActiveClass,
}: {
  isActive: boolean
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  users: User[]
  propertyStructures: Structure[]
  propertyRooms: RoomShape[]
  occupantsByRoom: Map<number | null, DraftOccupant[]>
  unassigned: DraftOccupant[]
  conflicts: PreviewConflicts | undefined
  submitState: SubmitState
  submit: (action: SubmitAction) => void
  hasWarnings: boolean
  canSubmit: boolean
  isPending: boolean
  roomOverCapacityDays: Map<number, string[]>
  stepClass: string
  stepActiveClass: string
}) {
  const bookerName = users.find(u => u.id === draft.booker_id)?.name ?? "—"
  const nights = draft.start_date && draft.end_date
    ? Math.round((new Date(draft.end_date).getTime() - new Date(draft.start_date).getTime()) / 86400000)
    : null
  const guestNames = draft.occupants
    .filter(o => o.user_id !== draft.booker_id)
    .map(o => {
      const u = users.find(x => x.id === o.user_id)
      if (!u) return `#${String(o.user_id)}`
      return `${u.name}${u.is_child ? " (child)" : ""}${o.queued ? " (queued)" : ""}`
    })
  const roomEntries = propertyStructures.flatMap(b =>
    propertyRooms
      .filter(r => r.structure_id === b.id)
      .map(r => {
        const occs = (occupantsByRoom.get(r.id) ?? []).map(o => {
          const u = users.find(x => x.id === o.user_id)
          return u ? `${u.name}${u.is_child ? " (child)" : ""}` : `#${String(o.user_id)}`
        })
        return { structureName: b.name, roomName: r.name, occupants: occs }
      })
      .filter(e => e.occupants.length > 0),
  )
  const unassignedNames = unassigned.map(o => {
    const u = users.find(x => x.id === o.user_id)
    return u
      ? `${u.name}${u.is_child ? " (child)" : ""}`
      : `#${String(o.user_id)}`
  })

  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <Heading level={4}>Review request</Heading>
        <dl style={{ margin: 0 }}>
          <dt>
            <strong>When</strong>
          </dt>
          <dd style={{ margin: "0 0 0.5rem 0" }}>
            {draft.start_date && draft.end_date
              ? `${draft.start_date} → ${draft.end_date} (${String(nights)} night${nights === 1 ? "" : "s"})`
              : "Dates not selected"}
          </dd>

          <dt>
            <strong>Who</strong>
          </dt>
          <dd style={{ margin: "0 0 0.5rem 0" }}>
            {bookerName} (booker)
            {guestNames.length > 0 && <> · {guestNames.join(", ")}</>}
          </dd>

          <dt>
            <strong>Where</strong>
          </dt>
          <dd style={{ margin: "0 0 0.5rem 0" }}>
            {roomEntries.length === 0 &&
              unassignedNames.length === 0 &&
              "No occupants yet"}
            {roomEntries.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {roomEntries.map(e => (
                  <li key={`${e.structureName}-${e.roomName}`}>
                    {e.structureName} · {e.roomName}: {e.occupants.join(", ")}
                  </li>
                ))}
              </ul>
            )}
            {unassignedNames.length > 0 && (
              <div>Unassigned: {unassignedNames.join(", ")}</div>
            )}
          </dd>

          <dt>
            <strong>Status</strong>
          </dt>
          <dd style={{ margin: 0, textTransform: "capitalize" }}>
            {draft.status}
          </dd>
        </dl>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <Heading level={4}>Details</Heading>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Field>
            <Label>Status</Label>
            <Select
              value={draft.status}
              onChange={e => {
                dispatch(
                  setStatus(
                    e.target.value as "pending" | "confirmed" | "cancelled",
                  ),
                )
              }}
            >
              <Select.Option value="pending">Pending</Select.Option>
              <Select.Option value="confirmed">Confirmed</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Field>
          <Textfield
            label="Notes"
            value={draft.notes}
            onChange={e => {
              dispatch(setNotes(e.target.value))
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {!submitState.confirming && (
        <Button type="submit" disabled={!canSubmit}>
          {isPending
            ? "Saving…"
            : hasWarnings
              ? "Request stay (warnings present)"
              : "Request stay"}
        </Button>
      )}

      {submitState.confirming && conflicts && (
        <ConfirmStep
          conflicts={conflicts}
          draft={draft}
          isMutating={isPending}
          onConfirm={(d: BookingDraft) => {
            submit({ kind: "confirm", draft: d })
          }}
          onCancel={() => {
            submit({ kind: "cancel" })
          }}
          roomOverCapacityDays={roomOverCapacityDays}
        />
      )}

      {submitState.error && (
        <Paragraph
          data-color="danger"
          role="alert"
          style={{ marginTop: "0.5rem" }}
        >
          Error: {submitState.error}
        </Paragraph>
      )}
    </div>
  )
}
