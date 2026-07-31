import { useTranslation } from "react-i18next"
import { InventoryList } from "./InventoryList"

// The food inventory shown on /handleliste. Its groups are the property's
// food-kind categories (legacy pre-section categories were folded in as food).
export function FoodInventory() {
  const { t } = useTranslation("inventory")
  return (
    <InventoryList
      kind="food"
      emptyStateTitle={t("Add or select a property to keep a food inventory.")}
    />
  )
}
