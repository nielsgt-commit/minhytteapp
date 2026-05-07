import { useSuspenseQuery } from "@tanstack/react-query"
import { Heading, List, Paragraph } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export default function ContactsSummary() {
  const trpc = useTRPC()
  const propertyId = useAppSelector(selectSelectedPropertyId) ?? 0
  const { data: contacts } = useSuspenseQuery(
    trpc.propertyContact.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  return (
    <>
      <Heading level={4}>Contacts</Heading>
      {contacts.length === 0 ? (
        <Paragraph>No contacts.</Paragraph>
      ) : (
        <List.Unordered style={{ listStyle: "none", padding: 0 }}>
          {contacts.map(c => (
            <List.Item key={c.id}>
              <strong>{c.name}</strong>
              {c.phone && <> — {c.phone}</>}
              {c.email && <> — {c.email}</>}
              {c.info && <> — {c.info}</>}
            </List.Item>
          ))}
        </List.Unordered>
      )}
    </>
  )
}