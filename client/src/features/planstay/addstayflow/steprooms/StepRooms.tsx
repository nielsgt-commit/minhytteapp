import type { Dispatch } from "react"
import { useState } from "react"
import {
  Card,
  Checkbox,
  Heading,
  Label,
  Paragraph,
  Tag,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { TENT_CAPACITY, TENT_ROOM_ID } from "@server/shared/bedOccupancy.ts"
import {
  assignOccupantToRoom,
  markOccupantQueued,
  removeOccupant,
  setOccupantSeparate,
} from "@/features/planstay/booking-logic"
import type {
  BookingDraft,
  BookingDraftAction,
  PreviewConflicts,
} from "@/features/planstay/booking-logic"
import { RoomCapacityMeter } from "../roomcapacitymeter/RoomCapacityMeter.tsx"
import { UnassignedPanel } from "../unassignedpanel/UnassignedPanel.tsx"
import type { ExistingOccupant, RoomShape } from "@/features/planstay/types.ts"
import styles from "./StepRooms.module.css"

type User = { id: number; name: string; is_child: boolean | null }
type Structure = { id: number; name: string }
type DraftOccupant = { user_id: number; queued: boolean }

export function StepRooms({
  isActive,
  isFetching,
  propertyStructures,
  propertyRooms,
  users,
  occupantsByRoom,
  existingOccupantsByRoom,
  adultInKidOnlyByRoom,
  unassigned,
  tent,
  existingTent,
  draft,
  dispatch,
  selectedUserId,
  expandedRoomId,
  setExpandedRoomId,
  conflicts,
  stepClass,
  stepActiveClass,
  heading,
  description,
}: {
  isActive: boolean
  isFetching: boolean
  propertyStructures: Structure[]
  propertyRooms: RoomShape[]
  users: User[]
  occupantsByRoom: Map<number | null, DraftOccupant[]>
  existingOccupantsByRoom: Map<number, ExistingOccupant[]>
  adultInKidOnlyByRoom: Map<number, number[]>
  unassigned: DraftOccupant[]
  tent: DraftOccupant[]
  existingTent: ExistingOccupant[]
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  selectedUserId: number | null
  expandedRoomId: number | null
  setExpandedRoomId: (updater: (prev: number | null) => number | null) => void
  conflicts: PreviewConflicts | undefined
  stepClass: string
  stepActiveClass: string
  heading?: string
  description?: string
}) {
  const { t } = useTranslation("planstay")
  const [hasTent, setHasTent] = useState(() => tent.length > 0)
  // Virtual room: assigning here flips sleeps_separately instead of room_id.
  const tentRoom: RoomShape = {
    id: TENT_ROOM_ID,
    name: t("Tent"),
    structure_id: TENT_ROOM_ID,
    beds_sm: 0,
    beds_lg: 0,
    beds_double: 0,
    beds_kid: 0,
    travel_cot: 0,
    mattresses: TENT_CAPACITY,
  }
  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <Card className={styles.card}>
        <Card.Block>
          <div className={styles.headingRow}>
            <Heading level={4}>{heading ?? t("Rooms")}</Heading>
            {draft.start_date && draft.end_date && (
              <Tag data-color="info">
                {draft.start_date} → {draft.end_date}
              </Tag>
            )}
          </div>
          {description && <Paragraph data-size="sm">{description}</Paragraph>}
          {isFetching && (
            <Paragraph className={styles.loading}>
              {t("Checking conflicts…")}
            </Paragraph>
          )}

          <div className={styles.tentToggle}>
            <Checkbox
              label={t("I have a tent (separate sleeping arrangement)")}
              checked={hasTent}
              onChange={e => {
                const on = e.target.checked
                setHasTent(on)
                if (!on) {
                  for (const o of tent) {
                    dispatch(setOccupantSeparate(o.user_id, false))
                  }
                }
              }}
            />
          </div>

          <ul className={styles.buildingList}>
            {hasTent && (
              <li>
                <Label data-size="sm" className={styles.buildingLabel}>
                  {t("Tent")}
                </Label>
                <Paragraph data-size="sm" className={styles.tentHint}>
                  {t("Sleeps separately — counts as a stay but uses no bed.")}
                </Paragraph>
                <ul className={styles.roomList}>
                  <li>
                    <RoomCapacityMeter
                      room={tentRoom}
                      // Building label above already says "Tent"; skip the
                      // duplicate structure sub-line inside the card.
                      structureName=""
                      occupantsInRoom={tent}
                      existingOccupantsInRoom={existingTent}
                      users={users}
                      adultInKidOnlyUserIds={[]}
                      unassignedOccupants={unassigned}
                      onAssign={uid => {
                        dispatch(setOccupantSeparate(uid, true))
                      }}
                      onRemove={uid => {
                        dispatch(setOccupantSeparate(uid, false))
                      }}
                      // Removing from the tent only unassigns (back to
                      // "unassigned"), so the booker may be removed too.
                      isBooker={() => false}
                      isExpanded={expandedRoomId === TENT_ROOM_ID}
                      onToggle={() => {
                        setExpandedRoomId(prev =>
                          prev === TENT_ROOM_ID ? null : TENT_ROOM_ID,
                        )
                      }}
                    />
                  </li>
                </ul>
              </li>
            )}
            {propertyStructures.map(building => {
              const buildingRooms = propertyRooms.filter(
                r => r.structure_id === building.id,
              )
              if (buildingRooms.length === 0) return null
              return (
                <li key={building.id}>
                  <Label data-size="sm" className={styles.buildingLabel}>
                    {building.name}
                  </Label>
                  <ul className={styles.roomList}>
                    {buildingRooms.map(r => (
                      <li key={r.id}>
                        <RoomCapacityMeter
                          room={r}
                          structureName={building.name}
                          occupantsInRoom={occupantsByRoom.get(r.id) ?? []}
                          existingOccupantsInRoom={
                            existingOccupantsByRoom.get(r.id) ?? []
                          }
                          users={users}
                          adultInKidOnlyUserIds={
                            adultInKidOnlyByRoom.get(r.id) ?? []
                          }
                          unassignedOccupants={unassigned}
                          onAssign={(uid, roomId) => {
                            dispatch(assignOccupantToRoom(uid, roomId))
                          }}
                          onRemove={uid => {
                            dispatch(removeOccupant(uid))
                          }}
                          isBooker={uid => uid === selectedUserId}
                          isExpanded={expandedRoomId === r.id}
                          onToggle={() => {
                            setExpandedRoomId(prev =>
                              prev === r.id ? null : r.id,
                            )
                          }}
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
                  onQueue={(uid, q) => {
                    dispatch(markOccupantQueued(uid, q))
                  }}
                />
              </li>
            )}
          </ul>
        </Card.Block>
      </Card>
    </div>
  )
}
