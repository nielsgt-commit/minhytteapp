import { useTranslation } from "react-i18next"
import styles from "./GeneralInventoryPage.module.css"
import { PageHeader } from "@/components/shared/PageHeader"
import { GeneralInventory } from "./GeneralInventory"

// The /inventar page: the general "what we already have" inventory.
export function GeneralInventoryPage() {
  const { t } = useTranslation("inventory")
  return (
    <section className={styles.page}>
      <PageHeader
        title={t("Inventory")}
        help={{
          intro: t(
            "Keep track of what you already have at the cabin — with an optional quantity and where it is stored.",
          ),
        }}
      />
      <GeneralInventory />
    </section>
  )
}
