import { useSuspenseQuery } from "@tanstack/react-query"
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
      <h4>Contacts</h4>
      {contacts.length === 0 ? (
        <p>No contacts.</p>
      ) : (
        <ul>
          {contacts.map(c => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.phone && <> — {c.phone}</>}
              {c.email && <> — {c.email}</>}
              {c.info && <> — {c.info}</>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}