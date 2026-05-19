import type { Dispatch } from "react"
import { Heading, Label, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import {
  assignOccupantToRoom,
  markOccupantQueued,
  removeOccupant,
} from "@/features/calendar/booking-logic"
import type { BookingDraft, BookingDraftAction, PreviewConflicts } from "@/features/calendar/booking-logic"
import { RoomCapacityMeter } from "../roomcapacitymeter/RoomCapacityMeter.tsx"
import { UnassignedPanel } from "../unassignedpanel/UnassignedPanel.tsx"
import type { ExistingOccupant, RoomShape } from "@/features/calendar/types.ts"
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
  draft,
  dispatch,
  selectedUserId,
  expandedRoomId,
  setExpandedRoomId,
  conflicts,
  stepClass,
  stepActiveClass,
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
  draft: BookingDraft
  dispatch: Dispatch<BookingDraftAction>
  selectedUserId: number | null
  expandedRoomId: number | null
  setExpandedRoomId: (updater: (prev: number | null) => number | null) => void
  conflicts: PreviewConflicts | undefined
  stepClass: string
  stepActiveClass: string
}) {
  const { t } = useTranslation("calendar")
  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <div className={styles.card}>
        <Heading level={4}>{t("Rooms")}</Heading>
        {isFetching && (
          <Paragraph className={styles.loading}>{t("Checking conflicts…")}</Paragraph>
        )}

        <ul className={styles.buildingList}>
          {propertyStructures.map(building => {
            const buildingRooms = propertyRooms.filter(r => r.structure_id === building.id)
            if (buildingRooms.length === 0) return null
            return (
              <li key={building.id}>
                <Label
                  data-size="sm"
                  className={styles.buildingLabel}
                >
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
                onQueue={(uid, q) => { dispatch(markOccupantQueued(uid, q)) }}
              />
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
