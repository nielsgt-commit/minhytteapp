import { createFileRoute } from "@tanstack/react-router"
import { PropertyContacts } from "@/features/property/propertyinfo/PropertyContacts"
import { trpc } from "@/trpc/client"

export const Route = createFileRoute("/_authed/administrer/kontakter")({
  loader: ({ context }) => {
    const { selectedPropertyId } = context
    if (selectedPropertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.propertyContact.listForProperty.queryOptions({
        property_id: selectedPropertyId,
      }),
    )
  },
  component: PropertyContacts,
})
