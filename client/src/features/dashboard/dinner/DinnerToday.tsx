import { Paragraph } from "@digdir/designsystemet-react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc.ts"

// Who is responsible for dinner today. The names are set per day from the
// kebab menu on the "This week" day cards; both read the same dinner query
// cache, so a change there shows up here immediately.
export function DinnerToday() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const today = Temporal.Now.plainDateISO()

  const { data: rows } = useSuspenseQuery(
    trpc.dinner.listForProperty.queryOptions({
      property_id: propertyId,
      start: today,
      end: today,
    }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const userById = new Map(users.map(u => [u.id, u.name]))
  const names = rows
    .map(r => userById.get(r.user_id))
    .filter((n): n is string => n != null)

  if (names.length === 0) {
    return <Paragraph>{t("No one responsible yet.")}</Paragraph>
  }

  return <Paragraph>{names.join(", ")}</Paragraph>
}
