import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Heading, Link, Paragraph } from "@digdir/designsystemet-react"
import { EnvelopeClosedIcon, PhoneIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTRPC } from "@/trpc/trpc"
import styles from "./ContactsPage.module.css"

// The /kontakter page: the property's contact list, read-only with every
// detail on the card. Contacts are managed under /administrer/kontakter.
export function ContactsPage() {
  const { t } = useTranslation("property")
  const propertyId = useSelectedPropertyId()
  return (
    <section className={styles.page}>
      <PageHeader
        title={t("Contacts")}
        help={{
          intro: t(
            "People to call for the property — caretakers, neighbours, service providers.",
          ),
        }}
      />
      {propertyId == null ? (
        <EmptyState title={t("Add or select a property to see contacts.")} />
      ) : (
        <QueryBoundary>
          <ContactCards propertyId={propertyId} />
        </QueryBoundary>
      )}
    </section>
  )
}

function ContactCards({ propertyId }: { propertyId: number }) {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const { data: contacts } = useSuspenseQuery(
    trpc.propertyContact.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  if (contacts.length === 0) {
    return <EmptyState title={t("No contacts yet.")} />
  }

  return (
    <ul className={styles.list}>
      {contacts.map(c => (
        <li key={c.id}>
          <Card>
            <Card.Block className={styles.cardBody}>
              <Heading level={3} data-size="xs">
                {c.name}
              </Heading>
              {c.phone && (
                <div className={styles.line}>
                  <PhoneIcon aria-hidden />
                  <Link href={`tel:${c.phone}`}>{c.phone}</Link>
                </div>
              )}
              {c.email && (
                <div className={styles.line}>
                  <EnvelopeClosedIcon aria-hidden />
                  <Link href={`mailto:${c.email}`}>{c.email}</Link>
                </div>
              )}
              {c.info && (
                <Paragraph className={styles.info}>{c.info}</Paragraph>
              )}
            </Card.Block>
          </Card>
        </li>
      ))}
    </ul>
  )
}
