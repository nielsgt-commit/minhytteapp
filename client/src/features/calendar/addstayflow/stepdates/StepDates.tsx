import { useMemo, type RefObject } from "react"
import { Card, Label, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./StepDates.module.css"

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

export function StepDates({
  isActive,
  rowRef,
  inputRef,
  totalBeds,
  occupiedBeds,
  overlappingBookings,
  overlappingPriorityWeeks,
  hasStartDate,
  stepClass,
  stepActiveClass,
}: {
  isActive: boolean
  rowRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  totalBeds: number
  occupiedBeds: number | null
  overlappingBookings: OverlappingBooking[]
  overlappingPriorityWeeks: PriorityWeek[]
  hasStartDate: boolean
  stepClass: string
  stepActiveClass: string
}) {
  const { t } = useTranslation("calendar")
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
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
      <div className={`fp-row ${styles.row}`} ref={rowRef}>
        <div className={`fp-container ${styles.container}`}>
          <input
            ref={inputRef}
            type="text"
            className={styles.hiddenInput}
            readOnly
          />
        </div>

        <div className={`fp-right-panel ${styles.rightPanel}`}>
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
                    {t("No other bookings in this period.")}
                  </Paragraph>
                )}
            </Card.Block>
          </Card>
        </div>
      </div>
    </div>
  )
}
