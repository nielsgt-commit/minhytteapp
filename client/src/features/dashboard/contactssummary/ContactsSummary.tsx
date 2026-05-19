import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { useQuery } from "@tanstack/react-query"
import { Details, Heading, Link, Paragraph } from "@digdir/designsystemet-react"
import { EnvelopeClosedIcon, PhoneIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./ContactsSummary.module.css"
import { useTRPC } from "@/trpc/trpc.ts"

export default function ContactsSummary() {
  const { t } = useTranslation("dashboard")
  const trpc = useTRPC()
  const propertyId = useSelectedPropertyId()
  const { data: contacts } = useQuery(
    trpc.propertyContact.listForProperty.queryOptions(
      { property_id: propertyId ?? 0 },
      { enabled: propertyId != null },
    ),
  )

  if (propertyId == null || !contacts) return null

  return (
    <Details>
      <Details.Summary>{t("Contacts")}</Details.Summary>
      <Details.Content>
        {contacts.length === 0 ? (
          <Paragraph>{t("No contacts.")}</Paragraph>
        ) : (
          <ul className={styles.list}>
            {contacts.map(c => (
              <li key={c.id} className={styles.item}>
                <Heading level={4} data-size="xs">{c.name}</Heading>
                {c.phone && (
                  <div className={styles.line}>
                    <PhoneIcon aria-hidden className={styles.icon} />
                    <Link href={`tel:${c.phone}`}>{c.phone}</Link>
                  </div>
                )}
                {c.email && (
                  <div className={styles.line}>
                    <EnvelopeClosedIcon aria-hidden className={styles.icon} />
                    <Link href={`mailto:${c.email}`}>{c.email}</Link>
                  </div>
                )}
                {c.info && <Paragraph>{c.info}</Paragraph>}
              </li>
            ))}
          </ul>
        )}
      </Details.Content>
    </Details>
  )
}