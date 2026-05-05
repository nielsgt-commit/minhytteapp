import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import BuildingSummary from "@/features/dashboard/buildingsummary/BuildingSummary"
import UserSummary from "@/features/dashboard/usersummary/UserSummary"
import RoomsSummary from "@/features/dashboard/roomssummary/RoomsSummary"

export default function PropertyStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  return (
    <>
      <h4>Manage {selectedProperty?.name ?? ""}</h4>
      <BuildingSummary />
      <UserSummary />
      <RoomsSummary />
    </>
  )
}