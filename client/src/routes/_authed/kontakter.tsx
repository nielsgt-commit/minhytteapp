import { createFileRoute } from "@tanstack/react-router"
import { ContactsPage } from "@/features/contacts/ContactsPage"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/kontakter")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.propertyContact.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: ContactsPage,
})
