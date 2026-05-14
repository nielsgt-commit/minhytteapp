import { useMemo, useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Paragraph,
  Select,
  EXPERIMENTAL_Suggestion as Suggestion,
  Tag,
  Textfield,
} from "@digdir/designsystemet-react"
import type { SuggestionItem } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedUserId } from "@/features/user/userSlice"
import {
  addOccupant,
  assignOccupantToRoom,
  markOccupantQueued,
  removeOccupant,
  setNotes,
  setStatus,
} from "@/features/calendar/booking-logic"
import { RoomCapacityMeter } from "./components/RoomCapacityMeter"
import { UnassignedPanel } from "./components/UnassignedPanel"
import { ConfirmStep } from "./components/ConfirmStep"
import { useFlatpickr } from "./hooks/useFlatpickr"
import { useBookingForm } from "./hooks/useBookingForm"
import { useOccupancyData } from "./hooks/useOccupancyData"

function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (dow - 1))
  const target = new Date(week1Mon)
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7)
  return target
}

export function A3Body({ propertyId }: { propertyId: number }) {
  const trpc = useTRPC()
  const selectedUserId = useAppSelector(selectSelectedUserId)

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: rooms } = useSuspenseQuery(trpc.room.list.queryOptions())
  const { data: buildings } = useSuspenseQuery(trpc.building.list.queryOptions())
  const { data: bookings } = useSuspenseQuery(
    trpc.booking.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const {
    draft,
    dispatch,
    confirmStep,
    setConfirmStep,
    submitError,
    conflicts,
    isFetching,
    hasWarnings,
    doMutate,
    handleSubmit,
    canSubmit,
    isPending,
  } = useBookingForm(propertyId, selectedUserId)

  const { inputRef, rowRef, guestInputRef } = useFlatpickr(draft, dispatch)

  const propertyBuildings = buildings.filter(b => b.property_id === propertyId)
  const propertyBuildingIds = new Set(propertyBuildings.map(b => b.id))
  const propertyRooms = rooms.filter(r => propertyBuildingIds.has(r.building_id))
  const buildingNameById = new Map(propertyBuildings.map(b => [b.id, b.name]))
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null)
  const otherUsers = users.filter(u => u.id !== selectedUserId)

  const {
    totalBeds,
    occupiedBeds,
    occupantsByRoom,
    unassigned,
    adultInKidOnlyByRoom,
    overlappingBookings,
    existingOccupantsByRoom,
  } = useOccupancyData({ bookings, draft, propertyRooms, propertyBuildings, conflicts })

  const draftYear = draft.start_date ? parseInt(draft.start_date.slice(0, 4)) : new Date().getFullYear()
  const { data: priorityData } = useQuery({
    ...trpc.priority.list.queryOptions({ property_id: propertyId, year: draftYear }),
    enabled: draft.start_date != null && draft.end_date != null,
  })

  const overlappingPriorityWeeks = useMemo(() => {
    if (!draft.start_date || !draft.end_date || !priorityData) return []
    const ownerNameById = new Map(priorityData.eligibleOwners.map(o => [o.property_owner_id, o.user_name]))
    return priorityData.assignments
      .filter(a => {
        const weekStart = isoWeekMonday(a.year, a.iso_week)
        const weekEnd = new Date(weekStart)
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
        return weekStart.toISOString().slice(0, 10) <= draft.end_date! && weekEnd.toISOString().slice(0, 10) >= draft.start_date!
      })
      .map(a => ({ iso_week: a.iso_week, owner_name: ownerNameById.get(a.property_owner_id) ?? `#${String(a.property_owner_id)}` }))
  }, [draft.start_date, draft.end_date, priorityData])

  return (

    <section>
      <Heading level={4}> 1 Pick dates</Heading>

      {selectedUserId == null && (
        <Paragraph role="alert">No user selected — pick one from the header.</Paragraph>
      )}

      {/* Step 1: flatpickr stands alone; availability info in a sibling Card */}
      <div
        className="fp-row"
        ref={rowRef}
        style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "1rem" }}
      >
        <div className="fp-container" style={{ maxWidth: "100%" }}>
          <input ref={inputRef} type="text" style={{ display: "none" }} readOnly />
        </div>

        <div className="fp-right-panel" style={{ flex: 1, minWidth: "15rem" }}>
          <Card>
            <Card.Block>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                {occupiedBeds !== null ? (
                  (() => {
                    const ratio = totalBeds > 0 ? (totalBeds - occupiedBeds) / totalBeds : 1
                    const [color, label]: ["danger" | "warning" | "neutral" | "success", string] =
                      ratio <= 0 ? ["danger", "At capacity"] :
                      ratio <= 0.3 ? ["warning", "Almost at capacity"] :
                      ratio <= 0.6 ? ["neutral", "Limited availability"] :
                      ["success", "High availability"]
                    return <Tag data-color={color}>{label}</Tag>
                  })()
                ) : (
                  <Paragraph data-size="sm" style={{ color: "var(--ds-color-neutral-text-subtle)", margin: 0 }}>
                    Pick dates to see availability.
                  </Paragraph>
                )}

                {overlappingPriorityWeeks.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", justifyContent: "flex-end" }}>
                    {overlappingPriorityWeeks.map(pw => (
                      <Tag key={pw.iso_week} data-color="neutral">
                        W{pw.iso_week} priority: {pw.owner_name}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>

              {overlappingBookings.length > 0 && (
                <div>
                  <Label data-size="sm" style={{ display: "block", marginBottom: "0.25rem" }}>
                    During this period:
                  </Label>
                  <Paragraph data-size="sm" style={{ margin: 0 }}>
                    {(() => {
                      const seen = new Map<number, { name: string; queued: boolean }>()
                      for (const o of overlappingBookings.flatMap(b => b.occupants)) {
                        if (!seen.has(o.user_id) || (!o.queued && seen.get(o.user_id)!.queued)) {
                          seen.set(o.user_id, { name: o.user_name ?? `#${String(o.user_id)}`, queued: o.queued })
                        }
                      }
                      const confirmed = Array.from(seen.values()).filter(o => !o.queued).map(o => o.name)
                      const queued = Array.from(seen.values()).filter(o => o.queued).map(o => `${o.name}?`)
                      return queued.length > 0
                        ? `${confirmed.join(", ")} (+ ${queued.join(", ")})`
                        : confirmed.join(", ")
                    })()}
                  </Paragraph>
                </div>
              )}

              {draft.start_date != null && overlappingBookings.length === 0 && occupiedBeds !== null && (
                <Paragraph data-size="sm" style={{ color: "var(--ds-color-neutral-text-subtle)", margin: 0 }}>
                  No other bookings in this period.
                </Paragraph>
              )}
            </Card.Block>
          </Card>
        </div>
      </div>

      {/* Step 2: guests */}
      <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
        <Heading level={5}>2. Who&apos;s coming?</Heading>

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

      {/* Step 3: room assignment */}
      <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
        <Heading level={5}>3. Assign rooms</Heading>
        {isFetching && (
          <Paragraph style={{ color: "#666", fontSize: "0.85rem" }}>Checking conflicts…</Paragraph>
        )}

        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {propertyBuildings.map(building => {
            const buildingRooms = propertyRooms.filter(r => r.building_id === building.id)
            if (buildingRooms.length === 0) return null
            return (
              <li key={building.id}>
                <Label data-size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ds-color-neutral-text-subtle)", display: "block", marginBottom: "0.25rem" }}>
                  {building.name}
                </Label>
                <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {buildingRooms.map(r => (
                    <li key={r.id}>
                      <RoomCapacityMeter
                        room={r}
                        buildingName={building.name}
                        occupantsInRoom={occupantsByRoom.get(r.id) ?? []}
                        existingOccupantsInRoom={existingOccupantsByRoom.get(r.id) ?? []}
                        users={users}
                        adultInKidOnlyUserIds={adultInKidOnlyByRoom.get(r.id) ?? []}
                        unassignedOccupants={unassigned}
                        onAssign={(uid, roomId) => { dispatch(assignOccupantToRoom(uid, roomId)) }}
                        onRemove={uid => { dispatch(removeOccupant(uid)) }}
                        isBooker={uid => uid === selectedUserId}
                        isExpanded={expandedRoomId === r.id}
                        onToggle={() => { setExpandedRoomId(prev => prev === r.id ? null : r.id) }}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
          {draft.occupants.length > 0 && (
            <li>
              <UnassignedPanel
                occupants={unassigned}
                conflicts={conflicts}
                onQueue={(uid, q) => { dispatch(markOccupantQueued(uid, q)) }}
              />
            </li>
          )}
        </ul>
      </div>

      {/* Step 4: details */}
      <div style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
        <Heading level={5}>4. Details</Heading>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Field>
            <Label>Status</Label>
            <Select
              value={draft.status}
              onChange={e => {
                dispatch(setStatus(e.target.value as "pending" | "confirmed" | "cancelled"))
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
            onChange={e => { dispatch(setNotes(e.target.value)) }}
            style={{ minWidth: "20rem" }}
          />
        </div>
      </div>

      {/* Submit */}
      {!confirmStep && (
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {isPending
            ? "Saving…"
            : hasWarnings
              ? "Request stay (warnings present)"
              : "Request stay"}
        </Button>
      )}

      {confirmStep && conflicts && (
        <ConfirmStep
          conflicts={conflicts}
          draft={draft}
          isMutating={isPending}
          onConfirm={doMutate}
          onCancel={() => { setConfirmStep(false) }}
        />
      )}

      {submitError && (
        <Paragraph data-color="danger" role="alert" style={{ marginTop: "0.5rem" }}>
          Error: {submitError}
        </Paragraph>
      )}
    </section>
  )
}
