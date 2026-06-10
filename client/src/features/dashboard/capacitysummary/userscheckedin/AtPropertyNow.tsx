import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Avatar,
  EXPERIMENTAL_AvatarStack as AvatarStack,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./AtPropertyNow.module.css"

const VISIBLE_LIMIT = 4

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join("")
}

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

  const canTruncate = guests.length > VISIBLE_LIMIT
  const collapsed = canTruncate && !expanded
  const hiddenCount = collapsed ? guests.length - VISIBLE_LIMIT : 0
  const toggle = () => {
    setExpanded(e => !e)
  }

  if (collapsed) {
    return (
      <AvatarStack
        aria-label={t("At property now")}
        overlap={8}
        suffix={`+${String(hiddenCount)}`}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={false}
        className={`${styles.stack} ${styles.clickable}`}
      >
        {guests.slice(0, VISIBLE_LIMIT).map(g => (
          <Avatar
            key={g.user_id}
            aria-label={g.name}
            data-initials={initials(g.name)}
          />
        ))}
      </AvatarStack>
    )
  }

  if (canTruncate) {
    return (
      <div
        aria-label={t("At property now")}
        role="button"
        tabIndex={0}
        aria-expanded
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        className={styles.expandedList}
      >
        {guests.map(g => (
          <Avatar
            key={g.user_id}
            aria-label={g.name}
            data-initials={initials(g.name)}
          />
        ))}
      </div>
    )
  }

  return (
    <AvatarStack
      aria-label={t("At property now")}
      overlap={8}
      className={styles.stack}
    >
      {guests.map(g => (
        <Avatar
          key={g.user_id}
          aria-label={g.name}
          data-initials={initials(g.name)}
        />
      ))}
    </AvatarStack>
  )
}
