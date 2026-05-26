import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./PropertyEvents.module.css"

type EventItem = {
  year: number
  description: string
  buildingName: string
  key: string
}

export default function PropertyEvents() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const structureName = new Map(structures.map(s => [s.id, s.name]))

  const events: EventItem[] = [
    ...structures
      .filter(s => s.built_year != null)
      .map(s => ({
        year: s.built_year as number,
        description: t("{{name}} built", { name: s.name }),
        buildingName: s.name,
        key: `structure-${s.id}`,
      })),
    ...items
      .filter(i => i.severity === "major" && i.completed_at != null)
      .map(i => ({
        year: new Date(i.completed_at as Date | string).getFullYear(),
        description: i.description,
        buildingName:
          (i.structure_id != null && structureName.get(i.structure_id)) || "",
        key: `maintenance-${i.id}`,
      })),
  ].sort((a, b) => a.year - b.year)

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={6} data-size="md">{t("Property events")}</Heading>
          {events.length === 0 ? (
            <p>{t("No events.")}</p>
          ) : (
            <ul className={styles.list}>
              {events.map(ev => (
                <li key={ev.key}>
                  <Card asChild>
                    <article>
                      <Card.Block className={styles.eventBlock}>
                        <span>{ev.year} {ev.description}</span>
                        {ev.buildingName && (
                          <Tag data-color="info">{ev.buildingName}</Tag>
                        )}
                      </Card.Block>
                    </article>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Card.Block>
      </section>
    </Card>
  )
}
