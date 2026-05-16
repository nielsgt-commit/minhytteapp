import { useSuspenseQuery } from "@tanstack/react-query"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./PropertyStats.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import BuildingSummary from "@/features/dashboard/propertystats/buildingsummary/BuildingSummary"
import UserSummary from "@/features/dashboard/propertystats/usersummary/UserSummary"
import RoomsSummary from "@/features/dashboard/propertystats/roomssummary/RoomsSummary"
import InventorySummary from "@/features/dashboard/propertystats/inventorysummary/InventorySummary"

export default function PropertyStats() {
  const trpc = useTRPC()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const { data: properties } = useSuspenseQuery(
    trpc.property.list.queryOptions(),
  )
  const selectedProperty = properties.find(p => p.id === selectedPropertyId)

  return (
    <>
      <div className={styles.grid}>
        <UserSummary />
        <BuildingSummary />
        <RoomsSummary />
        <InventorySummary />
      </div>
    </>
  )
}