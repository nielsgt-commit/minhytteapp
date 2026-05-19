import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import styles from "./MyPlannedStay.module.css"

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart <= bEnd && bStart <= aEnd
}

function formatDayMonth(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

export function MyPlannedStay() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: bookings } = useQuery(
    trpc.booking.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const [openId, setOpenId] = useState<number | null>(null)

  if (selectedPropertyId == null) {
    return <p>{t("Select a property to see your stays.")}</p>
  }

  if (!me || !bookings) return <p>{t("Loading…")}</p>

  const active = bookings.filter(b => b.status !== "cancelled")
  const myBookings = active.filter(b =>
    b.occupants.some(o => o.user_id === me.id),
  )

  if (myBookings.length === 0) {
    return <p>{t("No planned stays yet.")}</p>
  }

  return (
    <ul className={styles.list}>
      {myBookings.map(b => {
        const otherNames = new Set<string>()
        for (const other of active) {
          if (!rangesOverlap(b.start_date, b.end_date, other.start_date, other.end_date)) continue
          for (const o of other.occupants) {
            if (o.user_id === me.id) continue
            otherNames.add(o.user_name ?? `#${String(o.user_id)}`)
          }
        }
        const names = Array.from(otherNames)
        const isOpen = openId === b.id
        const toggle = () => { setOpenId(prev => (prev === b.id ? null : b.id)) }
        return (
          <Card asChild key={b.id}>
            <li>
              <Card.Block
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={toggle}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggle()
                  }
                }}
                className={styles.cardBlock}
              >
                <div>
                  {formatDayMonth(b.start_date)} – {formatDayMonth(b.end_date)}
                </div>
                {isOpen && (
                  <div className={styles.companions}>
                    {names.length > 0 ? (
                      <>
                        <span>{t("Accompanied by:")}</span>
                        {names.map(n => (
                          <Tag key={n} data-color="info">{n}</Tag>
                        ))}
                      </>
                    ) : (
                      <span>{t("Solo stay")}</span>
                    )}
                  </div>
                )}
              </Card.Block>
            </li>
          </Card>
        )
      })}
    </ul>
  )
}