import { useState } from "react"
import { ToggleGroup } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ShoppingList.module.css"
import { PageHeader } from "@/components/shared/PageHeader"
import type { PageHelpContent } from "@/components/shared/PageHelp"
import { FoodInventory } from "@/features/inventory"
import { ShoppingList } from "./ShoppingList"

type View = "shopping" | "inventory"

// The /handleliste page: a toggle between the shared shopping list (default)
// and the food inventory — what we still need vs what we already have.
export function ShoppingPage() {
  const { t } = useTranslation("shoppinglist")
  const [view, setView] = useState<View>("shopping")

  const help: PageHelpContent =
    view === "shopping"
      ? {
          intro: t(
            "Keep a shared shopping list for the cabin. Add things under Food or Other, check them off when bought, and remove them when you're done.",
          ),
        }
      : {
          intro: t(
            "Keep track of food you already have at the cabin. Add items with an optional quantity and where they are stored.",
          ),
        }

  return (
    <section className={styles.page}>
      <PageHeader
        title={view === "shopping" ? t("Shopping list") : t("Food inventory")}
        help={help}
      />
      <ToggleGroup
        value={view}
        onChange={value => {
          setView(value as View)
        }}
        data-size="sm"
        data-toggle-group={t("Choose list")}
        className={styles.viewToggle}
      >
        <ToggleGroup.Item value="shopping">
          {t("Shopping list")}
        </ToggleGroup.Item>
        <ToggleGroup.Item value="inventory">
          {t("Food inventory")}
        </ToggleGroup.Item>
      </ToggleGroup>
      {view === "shopping" ? <ShoppingList /> : <FoodInventory />}
    </section>
  )
}
