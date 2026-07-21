import { useTranslation } from "react-i18next"
import { FOOD_SECTIONS } from "@server/shared/inventorySections.ts"
import { InventoryList } from "./InventoryList"

// The food inventory shown on /handleliste. Also the home of the "Other"
// fallback group: legacy categories predate the fixed sections and have
// always surfaced here, so this is the one list that shows them.
export function FoodInventory() {
  const { t } = useTranslation("inventory")
  return (
    <InventoryList
      sections={FOOD_SECTIONS}
      emptyStateTitle={t("Add or select a property to keep a food inventory.")}
      showOtherGroup
    />
  )
}
