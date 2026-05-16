import { createFileRoute } from "@tanstack/react-router"
import PropertyContacts from "@/features/property/propertyinfo/PropertyContacts"
import { trpc } from "@/trpc/client"
import { store } from "@/app/store"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"

export const Route = createFileRoute("/_authed/manageproperty/contacts")({
  loader: ({ context }) => {
    const propertyId = selectSelectedPropertyId(store.getState())
    if (propertyId == null) return
    return context.queryClient.ensureQueryData(
      trpc.propertyContact.listForProperty.queryOptions({
        property_id: propertyId,
      }),
    )
  },
  component: PropertyContacts,
})
