import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Checkbox,
  Heading,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ShoppingList.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { PageHeader } from "@/components/shared/PageHeader"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import type { PageHelpContent } from "@/components/shared/PageHelp"

type Section = "food" | "other"

const SECTIONS: readonly Section[] = ["food", "other"]

export function ShoppingList() {
  const { t } = useTranslation("shoppinglist")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

  const help: PageHelpContent = {
    intro: t(
      "Keep a shared shopping list for the cabin. Add things under Food or Other, check them off when bought, and remove them when you're done.",
    ),
  }

  const { data: items, isLoading } = useQuery(
    trpc.shoppingItem.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const shoppingKeys = [trpc.shoppingItem.pathKey()]
  const createMutation = useMutationWithInvalidation(
    trpc.shoppingItem.create.mutationOptions(),
    shoppingKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.shoppingItem.update.mutationOptions(),
    shoppingKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.shoppingItem.delete.mutationOptions(),
    shoppingKeys,
  )

  const { pending, error } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  const [editingId, setEditingId] = useState<number | null>(null)

  const sectionLabel = (section: Section) =>
    section === "food" ? t("Food") : t("Other")

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Shopping list")} help={help} />
        <EmptyState
          title={t("Add or select a property to keep a shared shopping list.")}
        />
      </section>
    )
  }

  if (isLoading || !items) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Shopping list")} help={help} />
        <CardSkeleton />
      </section>
    )
  }

  const handleAdd = (section: Section) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    try {
      await createMutation.mutateAsync({
        property_id: selectedPropertyId,
        section,
        name,
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  const toggleChecked = (item: (typeof items)[number]) => {
    updateMutation.mutate({
      property_id: selectedPropertyId,
      id: item.id,
      checked: !item.checked,
    })
  }

  const handleRename =
    (item: (typeof items)[number]) => async (fd: FormData) => {
      const name = fdString(fd, "name").trim()
      if (!name) return
      try {
        await updateMutation.mutateAsync({
          property_id: selectedPropertyId,
          id: item.id,
          name,
        })
        setEditingId(null)
      } catch {
        // Surfaced via the aggregated ErrorAlert below.
      }
    }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Shopping list")} help={help} />
      <ErrorAlert error={error} />
      <div className={styles.sections}>
        {SECTIONS.map(section => {
          // Checked-off items sink to the bottom of their section; order is
          // otherwise stable (by id) within the checked / unchecked groups.
          const sectionItems = items
            .filter(i => i.section === section)
            .slice()
            .sort((a, b) => {
              if (a.checked !== b.checked) return a.checked ? 1 : -1
              return a.id - b.id
            })
          return (
            <div className={styles.section} key={section}>
              <Heading level={3} data-size="xs" className={styles.heading}>
                {sectionLabel(section)}
              </Heading>
              <form action={handleAdd(section)} className={styles.addRow}>
                <Textfield
                  aria-label={t("New item")}
                  name="name"
                  placeholder={t("Add item...")}
                  disabled={createMutation.isPending}
                />
                <SubmitButton>{t("Add")}</SubmitButton>
              </form>
              {sectionItems.length === 0 ? (
                <Paragraph data-size="sm">{t("Nothing here yet.")}</Paragraph>
              ) : (
                <ul className={styles.list}>
                  {sectionItems.map(item => (
                    <Card asChild key={item.id}>
                      <li>
                        <Card.Block className={styles.row} data-size="sm">
                          <Checkbox
                            aria-label={item.name}
                            checked={item.checked}
                            disabled={pending}
                            onChange={() => {
                              toggleChecked(item)
                            }}
                          />
                          {editingId === item.id ? (
                            <form
                              action={handleRename(item)}
                              className={styles.editForm}
                            >
                              <Textfield
                                aria-label={t("New item")}
                                name="name"
                                defaultValue={item.name}
                                disabled={updateMutation.isPending}
                              />
                              <SubmitButton>{t("Save")}</SubmitButton>
                              <Button
                                type="button"
                                variant="tertiary"
                                data-size="sm"
                                onClick={() => {
                                  setEditingId(null)
                                }}
                              >
                                {t("Cancel")}
                              </Button>
                            </form>
                          ) : (
                            <>
                              <Paragraph
                                className={`${styles.name} ${
                                  item.checked ? styles.done : ""
                                }`}
                                data-size="sm"
                              >
                                {item.name}
                              </Paragraph>
                              <div className={styles.actions}>
                                <Button
                                  variant="tertiary"
                                  data-size="sm"
                                  disabled={pending}
                                  onClick={() => {
                                    setEditingId(item.id)
                                  }}
                                >
                                  {t("Edit")}
                                </Button>
                                <Button
                                  variant="tertiary"
                                  data-color="danger"
                                  data-size="sm"
                                  disabled={pending}
                                  onClick={() => {
                                    deleteMutation.mutate({ id: item.id })
                                  }}
                                >
                                  {t("Delete")}
                                </Button>
                              </div>
                            </>
                          )}
                        </Card.Block>
                      </li>
                    </Card>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
