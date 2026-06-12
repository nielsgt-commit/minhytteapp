import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./PropertyEvents.module.css"

type EventItem = {
  year: number
  description: string
  buildingName: string
  key: string
  // When set, replaces the default `{year} {description}` rendering — used for
  // events whose phrasing reads better with the year at the end.
  label?: string
}

export function PropertyEvents() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId() ?? 0
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: items } = useSuspenseQuery(
    trpc.maintenance.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const inFamilySince = properties.find(p => p.id === propertyId)
    ?.in_family_since
  const structureName = new Map(structures.map(s => [s.id, s.name]))

  const events: EventItem[] = [
    ...(inFamilySince != null
      ? [
          {
            year: inFamilySince,
            description: "",
            buildingName: "",
            key: "in-family-since",
            label: t("This property has been in the family since: {{year}}", {
              year: inFamilySince,
            }),
          },
        ]
      : []),
    ...structures.flatMap(s =>
      s.built_year != null
        ? [
            {
              year: s.built_year,
              description: t("{{name}} built", { name: s.name }),
              buildingName: s.name,
              key: `structure-${String(s.id)}`,
            },
          ]
        : [],
    ),
    ...items.flatMap(i =>
      i.severity === "major" && i.completed_at != null
        ? [
            {
              // The event year is the Oslo-local year of the completion instant.
              year: i.completed_at.toZonedDateTimeISO("Europe/Oslo").year,
              description: i.description,
              buildingName:
                (i.structure_id != null
                  ? structureName.get(i.structure_id)
                  : null) ?? "",
              key: `maintenance-${String(i.id)}`,
            },
          ]
        : [],
    ),
  ].sort((a, b) => a.year - b.year)

  return (
    <Card asChild>
      <section>
        <Card.Block>
          <Heading level={6} data-size="md">
            {t("Property events")}
          </Heading>
          {events.length === 0 ? (
            <EmptyState title={t("No events.")} />
          ) : (
            <ul className={styles.list}>
              {events.map(ev => (
                <li key={ev.key}>
                  <Card asChild>
                    <article>
                      <Card.Block className={styles.eventBlock}>
                        <span>
                          {ev.label ?? `${String(ev.year)} ${ev.description}`}
                        </span>
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
