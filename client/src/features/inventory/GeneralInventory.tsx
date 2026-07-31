import { useTranslation } from "react-i18next"
import { InventoryList } from "./InventoryList"

// The general "what we already have" inventory shown on /inventar — bed
// linens, fishing rods, tools. Food items live on /handleliste; the split is
// the categories' kind.
export function GeneralInventory() {
  const { t } = useTranslation("inventory")
  return (
    <InventoryList
      kind="general"
      emptyStateTitle={t("Add or select a property to keep an inventory.")}
    />
  )
}
