import { useSuspenseQuery } from "@tanstack/react-query"
import { Heading } from "@digdir/designsystemet-react"
import styles from "./PropertyStats.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import StructureSummary from "@/features/dashboard/propertystats/structuresummary/StructureSummary"
import UserSummary from "@/features/dashboard/propertystats/usersummary/UserSummary"
import RoomsSummary from "@/features/dashboard/propertystats/roomssummary/RoomsSummary"
import EquipmentSummary from "@/features/dashboard/propertystats/equipmentsummary/EquipmentSummary"

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
        <StructureSummary />
        <RoomsSummary />
        <EquipmentSummary />
      </div>
    </>
  )
}