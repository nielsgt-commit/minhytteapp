import {
  Button,
  Card,
  Label,
  Paragraph,
  Select,
  Tag,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { bedCapacity } from "@/features/planstay/booking-logic"
import { BED_LABELS } from "../../constants.ts"
import { BedIconRow } from "../bedicons/BedIcons.tsx"
import type { RoomShape, ExistingOccupant } from "../../types.ts"
import styles from "./RoomCapacityMeter.module.css"

const BED_KEYS = [
  "beds_sm",
  "beds_lg",
  "beds_double",
  "beds_kid",
  "travel_cot",
  "mattresses",
] as const

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
  const { t } = useTranslation("planstay")
  const td = t as (key: string) => string
  const total = bedCapacity(room)
  const placed = occupantsInRoom.length + existingOccupantsInRoom.length
  const over = placed > total
  const adultInKidOnly = adultInKidOnlyUserIds.length > 0

  const bedSummary = BED_KEYS.filter(key => room[key] > 0)
    .map(
      key =>
        `${String(room[key])}× ${BED_LABELS[key] ? td(BED_LABELS[key]) : key}`,
    )
    .join(" · ")

  // Card's data-color type is narrower than Tag's; cast to allow feedback colors
  const cardColor = (over || adultInKidOnly ? "danger" : "neutral") as "neutral"
  return (
    <Card data-color={cardColor} className={styles.roomCard}>
      <Card.Block>
        {/* Always visible: toggle header */}
        <Button
          type="button"
          variant="tertiary"
          onClick={onToggle}
          className={styles.toggleButton}
          aria-expanded={isExpanded}
        >
          <div className={styles.header}>
            <div>
              <span>{room.name}</span>
              {structureName && (
                <div className={styles.structureName}>{structureName}</div>
              )}
            </div>
            <div className={styles.headerRight}>
              <BedIconRow
                total={total}
                existingCount={existingOccupantsInRoom.length}
                draftCount={occupantsInRoom.length}
              />
              <Tag
                data-color={
                  over ? "danger" : placed === total ? "warning" : "success"
                }
              >
                {t("{{placed}}/{{total}} beds", { placed, total })}
              </Tag>
              <span className={styles.chevron}>{isExpanded ? "▴" : "▾"}</span>
            </div>
          </div>
        </Button>

        {/* Expanded content */}
        {isExpanded && (
          <>
            {bedSummary && (
              <div className={styles.bedSummary}>{bedSummary}</div>
            )}

            {existingOccupantsInRoom.length > 0 && (
              <div className={styles.section}>
                <Label data-size="sm">{t("Already booked")}</Label>
                <div className={styles.tagRow}>
                  {existingOccupantsInRoom.map(o => (
                    <Tag
                      key={`existing-${String(o.user_id)}`}
                      data-color="neutral"
                    >
                      {o.user_name ?? `#${String(o.user_id)}`}
                      {o.queued ? t(" [Q]") : ""}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {occupantsInRoom.length > 0 && (
              <div className={styles.section}>
                {existingOccupantsInRoom.length > 0 && (
                  <Label data-size="sm">{t("Adding")}</Label>
                )}
                <div className={styles.tagRowLg}>
                  {occupantsInRoom.map(o => {
                    const u = users.find(x => x.id === o.user_id)
                    const isAdultKidOnly = adultInKidOnlyUserIds.includes(
                      o.user_id,
                    )
                    const color = isAdultKidOnly
                      ? "danger"
                      : o.queued
                        ? "warning"
                        : "accent"
                    return (
                      <div key={o.user_id} className={styles.occupantItem}>
                        <Tag data-color={color}>
                          {u?.name ?? `#${String(o.user_id)}`}
                          {u?.is_child ? t(" (kid)") : ""}
                          {o.queued ? t(" [Q]") : ""}
                          {isAdultKidOnly ? " !" : ""}
                        </Tag>
                        {!isBooker(o.user_id) && (
                          <Button
                            type="button"
                            variant="tertiary"
                            onClick={() => {
                              onRemove(o.user_id)
                            }}
                            aria-label={t("Remove {{name}}", {
                              name: u?.name ?? String(o.user_id),
                            })}
                            className={styles.removeButton}
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
                {t("Over capacity by {{count}}", { count: placed - total })}
              </Paragraph>
            )}
            {adultInKidOnly && (
              <Paragraph data-color="danger" data-size="sm">
                {t("Adult assigned to kid-only bed room")}
              </Paragraph>
            )}

            {unassignedOccupants.length > 0 && (
              <div className={styles.section}>
                <Select
                  value=""
                  onChange={e => {
                    const v = e.target.value
                    if (v) onAssign(Number(v), room.id)
                  }}
                >
                  <Select.Option value="">{t("Assign here…")}</Select.Option>
                  {unassignedOccupants.map(o => {
                    const u = users.find(x => x.id === o.user_id)
                    return (
                      <Select.Option key={o.user_id} value={o.user_id}>
                        {u?.name ?? `#${String(o.user_id)}`}
                        {u?.is_child ? t(" (kid)") : ""}
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
