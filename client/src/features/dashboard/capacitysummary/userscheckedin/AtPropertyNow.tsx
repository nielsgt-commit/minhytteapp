import { useState } from "react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Avatar,
  EXPERIMENTAL_AvatarStack as AvatarStack,
  Tooltip,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./AtPropertyNow.module.css"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join("")
}

const MAX_VISIBLE = 6

export function AtPropertyNow() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: guests } = useSuspenseQuery(
    trpc.stay.atProperty.queryOptions({ property_id: propertyId }),
  )
  const [expanded, setExpanded] = useState(false)

  if (guests.length === 0)
    return <EmptyState title={t("No one at the property right now.")} />

  const overflowing = guests.length > MAX_VISIBLE
  const visible = expanded ? guests : guests.slice(0, MAX_VISIBLE)

  return (
    <AvatarStack
      aria-label={t("At property now")}
      className={expanded ? `${styles.list} ${styles.expanded}` : styles.list}
      overlap={expanded ? -6 : 25}
      gap="1px"
      suffix={
        overflowing && !expanded
          ? `+${String(guests.length - MAX_VISIBLE)}`
          : undefined
      }
      onDoubleClick={
        overflowing
          ? () => {
              setExpanded(prev => !prev)
            }
          : undefined
      }
    >
      {visible.map(g => {
        const label = g.building_name
          ? `${g.name} · ${g.building_name}`
          : g.name
        return (
          <Tooltip key={g.user_id} content={label}>
            {/* tabIndex lets a tap/click focus the avatar, which opens the tooltip. */}
            <Avatar
              aria-label={label}
              data-initials={initials(g.name)}
              tabIndex={0}
            />
          </Tooltip>
        )
      })}
    </AvatarStack>
  )
}
