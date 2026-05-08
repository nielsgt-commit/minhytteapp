import { useSuspenseQuery } from "@tanstack/react-query"
import { Details, Paragraph, Table } from "@digdir/designsystemet-react"
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
    <Details>
      <Details.Summary>Contacts</Details.Summary>
      <Details.Content>
        {contacts.length === 0 ? (
          <Paragraph>No contacts.</Paragraph>
        ) : (
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell scope="col">Name</Table.HeaderCell>
                <Table.HeaderCell scope="col">Phone</Table.HeaderCell>
                <Table.HeaderCell scope="col">Email</Table.HeaderCell>
                <Table.HeaderCell scope="col">Info</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {contacts.map(c => (
                <Table.Row key={c.id}>
                  <Table.HeaderCell scope="row">{c.name}</Table.HeaderCell>
                  <Table.Cell>{c.phone}</Table.Cell>
                  <Table.Cell>{c.email}</Table.Cell>
                  <Table.Cell>{c.info}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Details.Content>
    </Details>
  )
}