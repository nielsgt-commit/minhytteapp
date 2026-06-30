import { useMemo } from "react"
import { Card, Label, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./StayAvailabilityPanel.module.css"

// The "who's already there" panel for the PlanStayFlowSheet dates step:
// availability indicator, overlapping priority weeks, and who else is planning
// to be at the cabin during the chosen period. Duplicated from the addstayflow
// StepDates right panel so the existing flow stays untouched; the data comes
// from the same hooks (useOccupancyData + useOverlappingPriorityWeeks).

type OverlappingBooking = {
  occupants: { user_id: number; queued: boolean; user_name: string | null }[]
}

type PriorityWeek = { iso_week: number; owner_name: string }

type AvailabilityLabel =
  | "At capacity"
  | "Almost at capacity"
  | "Limited availability"
  | "High availability"

type Availability = {
  color: "danger" | "warning" | "neutral" | "success"
  label: AvailabilityLabel
}

export function StayAvailabilityPanel({
  totalBeds,
  occupiedBeds,
  overlappingBookings,
  overlappingPriorityWeeks,
  hasStartDate,
}: {
  totalBeds: number
  occupiedBeds: number | null
  overlappingBookings: OverlappingBooking[]
  overlappingPriorityWeeks: PriorityWeek[]
  hasStartDate: boolean
}) {
  const { t } = useTranslation("planstay")

  const availability = useMemo<Availability | null>(() => {
    if (occupiedBeds === null) return null
    const ratio = totalBeds > 0 ? (totalBeds - occupiedBeds) / totalBeds : 1
    if (ratio <= 0) return { color: "danger", label: "At capacity" }
    if (ratio <= 0.3) return { color: "warning", label: "Almost at capacity" }
    if (ratio <= 0.6) return { color: "neutral", label: "Limited availability" }
    return { color: "success", label: "High availability" }
  }, [totalBeds, occupiedBeds])

  const overlappingOccupantsText = useMemo(() => {
    const seen = new Map<number, { name: string; queued: boolean }>()
    for (const o of overlappingBookings.flatMap(b => b.occupants)) {
      const existing = seen.get(o.user_id)
      if (!existing || (!o.queued && existing.queued)) {
        seen.set(o.user_id, {
          name: o.user_name ?? `#${String(o.user_id)}`,
          queued: o.queued,
        })
      }
    }
    const confirmed = Array.from(seen.values())
      .filter(o => !o.queued)
      .map(o => o.name)
    const queued = Array.from(seen.values())
      .filter(o => o.queued)
      .map(o => `${o.name}?`)
    return queued.length > 0
      ? `${confirmed.join(", ")} (+ ${queued.join(", ")})`
      : confirmed.join(", ")
  }, [overlappingBookings])

  return (
    <Card>
      <Card.Block>
        <div className={styles.cardHeader}>
          {availability !== null ? (
            <Tag data-color={availability.color}>
              {
                (
                  {
                    "At capacity": t("At capacity"),
                    "Almost at capacity": t("Almost at capacity"),
                    "Limited availability": t("Limited availability"),
                    "High availability": t("High availability"),
                  } satisfies Record<AvailabilityLabel, string>
                )[availability.label]
              }
            </Tag>
          ) : (
            <Paragraph data-size="sm" className={styles.subtleText}>
              {t("Pick dates to see availability.")}
            </Paragraph>
          )}

          {overlappingPriorityWeeks.length > 0 && (
            <div className={styles.priorityTags}>
              {overlappingPriorityWeeks.map(pw => (
                <Tag key={pw.iso_week} data-color="neutral">
                  {t("W{{week}} priority: {{name}}", {
                    week: pw.iso_week,
                    name: pw.owner_name,
                  })}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {overlappingBookings.length > 0 && (
          <div>
            <Label data-size="sm" className={styles.duringLabel}>
              {t("During this period:")}
            </Label>
            <Paragraph data-size="sm" className={styles.duringText}>
              {overlappingOccupantsText}
            </Paragraph>
          </div>
        )}

        {hasStartDate &&
          overlappingBookings.length === 0 &&
          occupiedBeds !== null && (
            <Paragraph data-size="sm" className={styles.subtleText}>
              {t("No other planned stays in this period.")}
            </Paragraph>
          )}
      </Card.Block>
    </Card>
  )
}
