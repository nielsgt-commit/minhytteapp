import { useSuspenseQuery } from "@tanstack/react-query"
import { Heading } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import BuildingSummary from "@/features/dashboard/propertystats/buildingsummary/BuildingSummary"
import UserSummary from "@/features/dashboard/propertystats/usersummary/UserSummary"
import RoomsSummary from "@/features/dashboard/propertystats/roomssummary/RoomsSummary"

export default function PropertyStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  return (
    <>
      <Heading level={4}> {selectedProperty?.name ?? ""} at a glance</Heading>
      <UserSummary />
      <BuildingSummary />
      <RoomsSummary />
    </>
  )
}