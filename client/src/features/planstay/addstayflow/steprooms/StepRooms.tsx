import type { Dispatch } from "react"
import { useState } from "react"
import {
  Button,
  Card,
  Checkbox,
  Heading,
  Label,
  Paragraph,
  Select,
  Tag,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
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
  const placeableInTent = draft.occupants.filter(o => !o.sleeps_separately)
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
            {hasTent && (
              <li>
                {/* Card's data-color type is narrower than Tag's; cast for info */}
                <Card
                  data-color={"info" as "neutral"}
                  className={styles.tentCard}
                >
                  <Card.Block>
                    <div className={styles.tentHeader}>
                      <Label data-size="sm">{t("Tent")}</Label>
                      <Tag data-color="info">{tent.length}</Tag>
                    </div>
                    <Paragraph data-size="sm" className={styles.tentHint}>
                      {t(
                        "Sleeps separately — counts as a stay but uses no bed.",
                      )}
                    </Paragraph>
                    {tent.length > 0 && (
                      <div className={styles.tentTagRow}>
                        {tent.map(o => {
                          const u = users.find(x => x.id === o.user_id)
                          return (
                            <div key={o.user_id} className={styles.tentItem}>
                              <Tag data-color="info">
                                {u?.name ?? `#${String(o.user_id)}`}
                                {u?.is_child ? t(" (kid)") : ""}
                              </Tag>
                              <Button
                                type="button"
                                variant="tertiary"
                                onClick={() => {
                                  dispatch(
                                    setOccupantSeparate(o.user_id, false),
                                  )
                                }}
                                aria-label={t("Remove {{name}}", {
                                  name: u?.name ?? String(o.user_id),
                                })}
                                className={styles.tentRemove}
                              >
                                ×
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {placeableInTent.length > 0 && (
                      <Select
                        value=""
                        onChange={e => {
                          const v = e.target.value
                          if (v) dispatch(setOccupantSeparate(Number(v), true))
                        }}
                      >
                        <Select.Option value="">
                          {t("Place in tent…")}
                        </Select.Option>
                        {placeableInTent.map(o => {
                          const u = users.find(x => x.id === o.user_id)
                          return (
                            <Select.Option key={o.user_id} value={o.user_id}>
                              {u?.name ?? `#${String(o.user_id)}`}
                              {u?.is_child ? t(" (kid)") : ""}
                            </Select.Option>
                          )
                        })}
                      </Select>
                    )}
                  </Card.Block>
                </Card>
              </li>
            )}
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
