import { Button, Card, Label, Paragraph, Select, Tag } from "@digdir/designsystemet-react"
import { bedCapacity } from "@/features/calendar/booking-logic"
import { BED_LABELS } from "../constants.ts"
import { BedIconRow } from "./BedIcons.tsx"
import type { RoomShape, ExistingOccupant } from "../types.ts"

const toggleButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  width: "100%",
  cursor: "pointer",
  textAlign: "left",
  display: "block",
  fontFamily: "inherit",
  fontSize: "inherit",
  color: "inherit",
}

const BED_KEYS = ["beds_sm", "beds_lg", "beds_double", "beds_kid", "travel_cot", "mattresses"] as const

export function RoomCapacityMeter({
  room,
  structureName,
  occupantsInRoom,
  existingOccupantsInRoom,
  users,
  adultInKidOnlyUserIds,
  unassignedOccupants,
  onAssign,
  onRemove,
  isBooker,
  isExpanded,
  onToggle,
}: {
  room: RoomShape
  structureName: string
  occupantsInRoom: { user_id: number; queued: boolean }[]
  existingOccupantsInRoom: ExistingOccupant[]
  users: { id: number; name: string; is_child: boolean | null }[]
  adultInKidOnlyUserIds: number[]
  unassignedOccupants: { user_id: number }[]
  onAssign: (userId: number, roomId: number) => void
  onRemove: (userId: number) => void
  isBooker: (uid: number) => boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const total = bedCapacity(room)
  const placed = occupantsInRoom.length + existingOccupantsInRoom.length
  const over = placed > total
  const adultInKidOnly = adultInKidOnlyUserIds.length > 0

  const bedSummary = BED_KEYS
    .filter(key => room[key] > 0)
    .map(key => `${room[key]}× ${BED_LABELS[key] ?? key}`)
    .join(" · ")

  // Card's data-color type is narrower than Tag's; cast to allow feedback colors
  const cardColor = (over || adultInKidOnly ? "danger" : "neutral") as "neutral"
  return (
    <Card data-color={cardColor}>
      <Card.Block>

        {/* Always visible: toggle header */}
        <Button type="button" variant="tertiary" onClick={onToggle} style={toggleButtonStyle} aria-expanded={isExpanded}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span>{room.name}</span>
              {structureName && (
                <div style={{ fontSize: "0.75rem", color: "var(--ds-color-neutral-text-subtle)" }}>
                  {structureName}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <BedIconRow
                total={total}
                existingCount={existingOccupantsInRoom.length}
                draftCount={occupantsInRoom.length}
              />
              <Tag data-color={over ? "danger" : placed === total ? "warning" : "success"}>
                {placed}/{total} beds
              </Tag>
              <span style={{ fontSize: "0.75rem", color: "var(--ds-color-neutral-text-subtle)", lineHeight: 1 }}>
                {isExpanded ? "▴" : "▾"}
              </span>
            </div>
          </div>

        </Button>

        {/* Expanded content */}
        {isExpanded && (
          <>
            {bedSummary && (
              <div style={{ fontSize: "0.8rem", color: "var(--ds-color-neutral-text-subtle)", marginTop: "0.5rem" }}>
                {bedSummary}
              </div>
            )}

            {existingOccupantsInRoom.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <Label data-size="sm">Already booked</Label>
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                  {existingOccupantsInRoom.map(o => (
                    <Tag key={`existing-${o.user_id}`} data-color="neutral">
                      {o.user_name ?? `#${String(o.user_id)}`}{o.queued ? " [Q]" : ""}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {occupantsInRoom.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                {existingOccupantsInRoom.length > 0 && <Label data-size="sm">Adding</Label>}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                  {occupantsInRoom.map(o => {
                    const u = users.find(x => x.id === o.user_id)
                    const isAdultKidOnly = adultInKidOnlyUserIds.includes(o.user_id)
                    const color = isAdultKidOnly ? "danger" : o.queued ? "warning" : "accent"
                    return (
                      <div key={o.user_id} style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Tag data-color={color}>
                          {u?.name ?? `#${String(o.user_id)}`}
                          {u?.is_child ? " (kid)" : ""}
                          {o.queued ? " [Q]" : ""}
                          {isAdultKidOnly ? " !" : ""}
                        </Tag>
                        {!isBooker(o.user_id) && (
                          <Button
                            type="button"
                            variant="tertiary"
                            onClick={() => { onRemove(o.user_id) }}
                            aria-label={`Remove ${u?.name ?? String(o.user_id)}`}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 0.15rem",
                              lineHeight: 1,
                              color: "var(--ds-color-neutral-text-subtle)",
                            }}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {over && (
              <Paragraph data-color="danger" data-size="sm">
                Over capacity by {placed - total}
              </Paragraph>
            )}
            {adultInKidOnly && (
              <Paragraph data-color="danger" data-size="sm">
                Adult assigned to kid-only bed room
              </Paragraph>
            )}

            {unassignedOccupants.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <Select
                  value=""
                  onChange={e => {
                    const v = e.target.value
                    if (v) onAssign(Number(v), room.id)
                  }}
                >
                  <Select.Option value="">Assign here…</Select.Option>
                  {unassignedOccupants.map(o => {
                    const u = users.find(x => x.id === o.user_id)
                    return (
                      <Select.Option key={o.user_id} value={o.user_id}>
                        {u?.name ?? `#${String(o.user_id)}`}{u?.is_child ? " (kid)" : ""}
                      </Select.Option>
                    )
                  })}
                </Select>
              </div>
            )}
          </>
        )}

      </Card.Block>
    </Card>
  )
}
