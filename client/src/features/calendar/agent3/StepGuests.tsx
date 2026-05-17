import type { Dispatch, RefObject } from "react"
import {
  Field,
  Heading,
  Label,
  Paragraph,
  EXPERIMENTAL_Suggestion as Suggestion,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { addOccupant, removeOccupant } from "@/features/calendar/booking-logic"
import type { BookingDraft, BookingDraftAction } from "@/features/calendar/booking-logic"

type User = { id: number; name: string; is_child: boolean | null }

export function StepGuests({
  isActive,
  users,
  otherUsers,
  selectedUserId,
  draft,
  dispatch,
  guestInputRef,
  stepClass,
  stepActiveClass,
}: {
  isActive: boolean
  users: User[]
  otherUsers: User[]
  selectedUserId: number | null
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  guestInputRef: RefObject<HTMLInputElement | null>
  stepClass: string
  stepActiveClass: string
}) {
  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
        <Heading level={5}></Heading>

        <Paragraph data-size="sm" style={{ marginBottom: "0.5rem" }}>
          Booker: {users.find(u => u.id === selectedUserId)?.name ?? "(select user)"}
        </Paragraph>
        <Field>
          <Label>Add guests</Label>
          <Suggestion
            multiple
            selected={draft.occupants
              .filter(o => o.user_id !== selectedUserId)
              .map(o => {
                const u = users.find(x => x.id === o.user_id)
                return {
                  value: String(o.user_id),
                  label: u ? `${u.name}${u.is_child ? " (child)" : ""}` : `#${String(o.user_id)}`,
                }
              })}
            onSelectedChange={(newItems: SuggestionItem[]) => {
              const newIds = new Set(newItems.map(i => Number(i.value)))
              const currentIds = new Set(
                draft.occupants.filter(o => o.user_id !== selectedUserId).map(o => o.user_id),
              )
              let added = false
              for (const item of newItems) {
                const uid = Number(item.value)
                if (!currentIds.has(uid)) { dispatch(addOccupant(uid, null)); added = true }
              }
              for (const uid of currentIds) {
                if (!newIds.has(uid)) dispatch(removeOccupant(uid))
              }
              if (added && guestInputRef.current) {
                guestInputRef.current.value = ""
                guestInputRef.current.dispatchEvent(new Event("input", { bubbles: true }))
              }
            }}
          >
            <Suggestion.Input ref={guestInputRef} placeholder="Search guests…" />
            <Suggestion.Clear />
            <Suggestion.List>
              <Suggestion.Empty>No guests found</Suggestion.Empty>
              {otherUsers.map(u => (
                <Suggestion.Option key={u.id} value={String(u.id)}>
                  {u.name}{u.is_child ? " (child)" : ""}
                </Suggestion.Option>
              ))}
            </Suggestion.List>
          </Suggestion>
        </Field>
      </div>
    </div>
  )
}
