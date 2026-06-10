import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import styles from "./PropertyStats.module.css"
import { StructureSummary } from "@/features/dashboard/propertystats/structuresummary/StructureSummary"
import { UserSummary } from "@/features/dashboard/propertystats/usersummary/UserSummary"
import { RoomsSummary } from "@/features/dashboard/propertystats/roomssummary/RoomsSummary"
import { EquipmentSummary } from "@/features/dashboard/propertystats/equipmentsummary/EquipmentSummary"

export function PropertyStats() {
  return (
    <div className={styles.grid}>
      <QueryBoundary>
        <UserSummary />
      </QueryBoundary>
      <QueryBoundary>
        <StructureSummary />
      </QueryBoundary>
      <QueryBoundary>
        <RoomsSummary />
      </QueryBoundary>
      <QueryBoundary>
        <EquipmentSummary />
      </QueryBoundary>
    </div>
  )
}
