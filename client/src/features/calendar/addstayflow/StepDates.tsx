import type { RefObject } from "react"
import { Card, Label, Paragraph, Tag } from "@digdir/designsystemet-react"

type OverlappingBooking = {
  occupants: { user_id: number; queued: boolean; user_name: string | null }[]
}

type PriorityWeek = { iso_week: number; owner_name: string }

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
  return (
    <div className={`${stepClass} ${isActive ? stepActiveClass : ""}`}>
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

              {hasStartDate && overlappingBookings.length === 0 && occupiedBeds !== null && (
                <Paragraph data-size="sm" style={{ color: "var(--ds-color-neutral-text-subtle)", margin: 0 }}>
                  No other bookings in this period.
                </Paragraph>
              )}
            </Card.Block>
          </Card>
        </div>
      </div>
    </div>
  )
}
