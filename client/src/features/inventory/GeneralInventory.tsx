import { useTranslation } from "react-i18next"
import { GENERAL_SECTIONS } from "@server/shared/inventorySections.ts"
import { InventoryList } from "./InventoryList"

// The general "what we already have" inventory shown on /inventar — bed
// linens, fishing rods, tools. Food items live on /handleliste; this list
// renders exactly its own sections and no "Other" fallback.
export function GeneralInventory() {
  const { t } = useTranslation("inventory")
  return (
    <InventoryList
      sections={GENERAL_SECTIONS}
      emptyStateTitle={t("Add or select a property to keep an inventory.")}
      showOtherGroup={false}
    />
  )
}
