import { useSelectedPropertyId } from "@/selection/useSelection"
import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import {
  Button,
  Checkbox,
  Heading,
  List,
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
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()

  const listKey = trpc.shoppingItem.listForProperty.queryKey({
    property_id: selectedPropertyId ?? 0,
  })

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
  // Optimistic add so the new item appears immediately. The temp id is larger
  // than any existing id so it sorts to the bottom of the unchecked group —
  // exactly where the real (serial) id lands, so there's no jump on refetch.
  const createMutation = useMutationWithInvalidation(
    trpc.shoppingItem.create.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old => {
          const nextId =
            (old ?? []).reduce((max, i) => Math.max(max, i.id), 0) + 1
          return [
            ...(old ?? []),
            {
              id: nextId,
              property_id: vars.property_id,
              section: vars.section,
              name: vars.name,
              checked: false,
              created_at: Temporal.Now.instant(),
              created_by: null,
            },
          ]
        })
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    shoppingKeys,
  )
  // Optimistic update so a checkbox toggle (and rename) takes effect instantly:
  // the item re-sorts in place rather than waiting for the round-trip and then
  // jumping, which read as a flicker. onSuccess (in the wrapper) still refetches.
  const updateMutation = useMutationWithInvalidation(
    trpc.shoppingItem.update.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(i =>
            i.id === vars.id
              ? {
                  ...i,
                  ...(vars.checked !== undefined && { checked: vars.checked }),
                  ...(vars.name !== undefined && { name: vars.name }),
                }
              : i,
          ),
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    shoppingKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.shoppingItem.delete.mutationOptions(),
    shoppingKeys,
  )

  const { error } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  // A toggle/rename is optimistic, so we don't disable the list for it — that
  // grey-out flash on every check was part of the flicker. Only a delete (an
  // item disappearing) blocks the row actions.
  const busy = deleteMutation.isPending

  const [editingId, setEditingId] = useState<number | null>(null)

  // Delete is a two-tap action: the first tap arms the item's Delete button,
  // a second tap on the same spot confirms. The armed state auto-clears after a
  // few seconds so a stale "Confirm delete?" can't be tapped much later.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )

  useEffect(() => {
    if (confirmingDeleteId == null) return
    const timer = setTimeout(() => {
      setConfirmingDeleteId(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [confirmingDeleteId])

  const handleDelete = (id: number) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      deleteMutation.mutate({ id })
    } else {
      setConfirmingDeleteId(id)
    }
  }

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
                />
                <SubmitButton>{t("Add")}</SubmitButton>
              </form>
              {sectionItems.length === 0 ? (
                <Paragraph data-size="sm">{t("Nothing here yet.")}</Paragraph>
              ) : (
                <List.Unordered className={styles.list}>
                  {sectionItems.map(item => (
                    <List.Item className={styles.row} key={item.id}>
                      {editingId !== item.id && (
                        <Checkbox
                          aria-label={item.name}
                          checked={item.checked}
                          onChange={() => {
                            toggleChecked(item)
                          }}
                        />
                      )}
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
                              disabled={busy}
                              onClick={() => {
                                setConfirmingDeleteId(null)
                                setEditingId(item.id)
                              }}
                            >
                              {t("Edit")}
                            </Button>
                            <Button
                              variant={
                                confirmingDeleteId === item.id
                                  ? "primary"
                                  : "tertiary"
                              }
                              data-color="danger"
                              data-size="sm"
                              disabled={busy}
                              onClick={() => {
                                handleDelete(item.id)
                              }}
                            >
                              {confirmingDeleteId === item.id
                                ? t("Confirm delete?")
                                : t("Delete")}
                            </Button>
                          </div>
                        </>
                      )}
                    </List.Item>
                  ))}
                </List.Unordered>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
