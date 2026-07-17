import { useSelectedPropertyId } from "@/selection/useSelection"
import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Divider,
  Dropdown,
  Heading,
  List,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./ShoppingList.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import { useIsMobile } from "@/hooks/useIsMobile"

type Section = "food" | "other"

const SECTIONS: readonly Section[] = ["food", "other"]

// After a toggle the row keeps its old sort position for a moment, so the user
// sees the box flip before the row sinks (or rises) to its new group.
const CHECK_HOLD_MS = 800

export function ShoppingList() {
  const { t } = useTranslation("shoppinglist")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()

  const listKey = trpc.shoppingItem.listForProperty.queryKey({
    property_id: selectedPropertyId ?? 0,
  })

  const { data: items, isLoading } = useQuery(
    trpc.shoppingItem.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      {
        enabled: selectedPropertyId != null,
        // Concurrent shoppers see each other's checkmarks near-live.
        refetchInterval: 15_000,
      },
    ),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: users } = useQuery(
    trpc.user.listForProperty.queryOptions(
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
              checked_by: null,
              created_at: Temporal.Now.instant(),
              created_by: null,
              assignee_ids: [],
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
                  ...(vars.checked !== undefined && {
                    checked: vars.checked,
                    checked_by: vars.checked ? (me?.id ?? null) : null,
                  }),
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
  const assignMutation = useMutationWithInvalidation(
    trpc.shoppingItem.setAssignee.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(i =>
            i.id === vars.id && !i.assignee_ids.includes(vars.user_id)
              ? { ...i, assignee_ids: [...i.assignee_ids, vars.user_id] }
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
  const unassignMutation = useMutationWithInvalidation(
    trpc.shoppingItem.removeAssignee.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(i =>
            i.id === vars.id
              ? {
                  ...i,
                  assignee_ids: i.assignee_ids.filter(
                    id => id !== vars.user_id,
                  ),
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
  const clearSectionMutation = useMutationWithInvalidation(
    trpc.shoppingItem.clearSection.mutationOptions(),
    shoppingKeys,
  )

  const { error } = useMutationsStatus(
    createMutation,
    updateMutation,
    assignMutation,
    unassignMutation,
    deleteMutation,
    clearSectionMutation,
  )

  // A toggle/rename is optimistic, so we don't disable the list for it — that
  // grey-out flash on every check was part of the flicker. Only a delete (an
  // item disappearing) blocks the row actions.
  const busy = deleteMutation.isPending || clearSectionMutation.isPending

  const [editingId, setEditingId] = useState<number | null>(null)

  // Which row (if any) has its inline "Assign to…" chip picker open.
  const [assigningId, setAssigningId] = useState<number | null>(null)

  // id → the checked value the sort keeps using while a toggle's hold lasts.
  const [heldSortChecked, setHeldSortChecked] = useState<
    ReadonlyMap<number, boolean>
  >(new Map())
  const holdTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const timers = holdTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }, [])

  // Delete is a two-tap action: the first tap arms the item's Delete button,
  // a second tap on the same spot confirms. The armed state auto-clears after a
  // few seconds so a stale "Confirm delete?" can't be tapped much later.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )

  // On mobile the row actions live behind a kebab menu; this tracks which row's
  // menu is open so the two-tap delete confirm can keep it open between taps.
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  // Same idea for the per-section heading kebab: which section's menu is open,
  // and which section's Clear is armed awaiting the confirming second tap.
  const [sectionMenuOpen, setSectionMenuOpen] = useState<Section | null>(null)
  const [confirmingClearSection, setConfirmingClearSection] =
    useState<Section | null>(null)

  useEffect(() => {
    if (confirmingDeleteId == null) return
    const timer = setTimeout(() => {
      setConfirmingDeleteId(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [confirmingDeleteId])

  useEffect(() => {
    if (confirmingClearSection == null) return
    const timer = setTimeout(() => {
      setConfirmingClearSection(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [confirmingClearSection])

  const handleDelete = (id: number) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      setMenuOpenId(null)
      deleteMutation.mutate({ id })
    } else {
      setConfirmingDeleteId(id)
    }
  }

  const toggleAssignee = (itemId: number, userId: number, next: boolean) => {
    if (selectedPropertyId == null) return
    const vars = {
      property_id: selectedPropertyId,
      id: itemId,
      user_id: userId,
    }
    if (next) assignMutation.mutate(vars)
    else unassignMutation.mutate(vars)
  }

  const userRows = users ?? []
  const userById = new Map(userRows.map(u => [u.id, u.name]))

  const sectionLabel = (section: Section) =>
    section === "food" ? t("Food") : t("Other")

  if (selectedPropertyId == null) {
    return (
      <EmptyState
        title={t("Add or select a property to keep a shared shopping list.")}
      />
    )
  }

  if (isLoading || !items) {
    return <CardSkeleton />
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

  const handleClear = (section: Section) => {
    if (confirmingClearSection === section) {
      setConfirmingClearSection(null)
      setSectionMenuOpen(null)
      clearSectionMutation.mutate({
        property_id: selectedPropertyId,
        section,
      })
    } else {
      setConfirmingClearSection(section)
    }
  }

  const toggleChecked = (item: (typeof items)[number]) => {
    // Freeze the row's sort slot at its pre-toggle value; a second toggle
    // within the hold keeps the original slot and just restarts the timer.
    setHeldSortChecked(old =>
      old.has(item.id) ? old : new Map(old).set(item.id, item.checked),
    )
    const existing = holdTimers.current.get(item.id)
    if (existing) clearTimeout(existing)
    holdTimers.current.set(
      item.id,
      setTimeout(() => {
        holdTimers.current.delete(item.id)
        setHeldSortChecked(old => {
          const next = new Map(old)
          next.delete(item.id)
          return next
        })
      }, CHECK_HOLD_MS),
    )
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

  // The assign picker lives in a dialog (opened from the row's kebab menu /
  // Assign to... button), so the row layout never has to make room for it.
  const assigningItem =
    assigningId == null ? undefined : items.find(i => i.id === assigningId)

  return (
    <>
      <ErrorAlert error={error} />
      <Card>
        <Card.Block className={styles.sections}>
          {SECTIONS.map((section, index) => {
            // Checked-off items sink to the bottom of their section; order is
            // otherwise stable (by id) within the checked / unchecked groups.
            // Rows inside a toggle hold sort by their pre-toggle value.
            const sectionItems = items
              .filter(i => i.section === section)
              .slice()
              .sort((a, b) => {
                const aChecked = heldSortChecked.get(a.id) ?? a.checked
                const bChecked = heldSortChecked.get(b.id) ?? b.checked
                if (aChecked !== bChecked) return aChecked ? 1 : -1
                return a.id - b.id
              })
            return (
              <div className={styles.section} key={section}>
                {index > 0 && <Divider />}
                <div className={styles.headingRow}>
                  <Heading level={3} data-size="xs" className={styles.heading}>
                    {sectionLabel(section)}
                  </Heading>
                  <Dropdown.TriggerContext>
                    <Dropdown.Trigger
                      variant="tertiary"
                      data-size="sm"
                      icon
                      aria-label={t("List actions")}
                      disabled={busy}
                      onClick={() => {
                        setSectionMenuOpen(
                          sectionMenuOpen === section ? null : section,
                        )
                        setConfirmingClearSection(null)
                      }}
                    >
                      <MenuElipsisVerticalIcon aria-hidden />
                    </Dropdown.Trigger>
                    <Dropdown
                      placement="bottom-end"
                      open={sectionMenuOpen === section}
                      onClose={() => {
                        setSectionMenuOpen(null)
                        setConfirmingClearSection(null)
                      }}
                    >
                      <Dropdown.List>
                        <Dropdown.Item>
                          <Dropdown.Button
                            data-color="danger"
                            disabled={sectionItems.length === 0}
                            onClick={() => {
                              handleClear(section)
                            }}
                          >
                            {confirmingClearSection === section
                              ? t("Confirm clear?")
                              : t("Clear list")}
                          </Dropdown.Button>
                        </Dropdown.Item>
                      </Dropdown.List>
                    </Dropdown>
                  </Dropdown.TriggerContext>
                </div>
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
                    {sectionItems.map(item => {
                      // Checked by a known other user → tint the box and name
                      // them, so it doesn't read as an accidental own tap.
                      const buyerName =
                        item.checked &&
                        item.checked_by != null &&
                        me != null &&
                        item.checked_by !== me.id
                          ? userById.get(item.checked_by)
                          : undefined
                      return (
                        <List.Item className={styles.row} key={item.id}>
                          {editingId !== item.id && (
                            <Checkbox
                              aria-label={item.name}
                              className={
                                buyerName != null
                                  ? styles.checkedByOther
                                  : undefined
                              }
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
                              <div className={styles.textCol}>
                                <Paragraph
                                  className={`${styles.name} ${
                                    item.checked ? styles.done : ""
                                  }`}
                                  data-size="sm"
                                >
                                  {item.name}
                                  {buyerName != null && (
                                    <span className={styles.checkedBy}>
                                      · {buyerName}
                                    </span>
                                  )}
                                </Paragraph>
                                {item.assignee_ids.length > 0 && (
                                  <Paragraph
                                    className={styles.assignees}
                                    data-size="sm"
                                  >
                                    {item.assignee_ids
                                      .map(id => userById.get(id))
                                      .filter((n): n is string => n != null)
                                      .join(", ")}
                                  </Paragraph>
                                )}
                              </div>
                              {isMobile ? (
                                <Dropdown.TriggerContext>
                                  <Dropdown.Trigger
                                    variant="tertiary"
                                    data-size="sm"
                                    icon
                                    className={styles.kebab}
                                    aria-label={t("Item actions")}
                                    disabled={busy}
                                    onClick={() => {
                                      setMenuOpenId(
                                        menuOpenId === item.id ? null : item.id,
                                      )
                                      setConfirmingDeleteId(null)
                                    }}
                                  >
                                    <MenuElipsisVerticalIcon aria-hidden />
                                  </Dropdown.Trigger>
                                  <Dropdown
                                    placement="bottom-end"
                                    open={menuOpenId === item.id}
                                    onClose={() => {
                                      setMenuOpenId(null)
                                      setConfirmingDeleteId(null)
                                    }}
                                  >
                                    <Dropdown.List>
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          onClick={() => {
                                            setMenuOpenId(null)
                                            setConfirmingDeleteId(null)
                                            setEditingId(item.id)
                                          }}
                                        >
                                          {t("Edit")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          onClick={() => {
                                            setMenuOpenId(null)
                                            setConfirmingDeleteId(null)
                                            setAssigningId(item.id)
                                          }}
                                        >
                                          {t("Assign to...")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                      <Dropdown.Item>
                                        <Dropdown.Button
                                          data-color="danger"
                                          onClick={() => {
                                            handleDelete(item.id)
                                          }}
                                        >
                                          {confirmingDeleteId === item.id
                                            ? t("Confirm delete?")
                                            : t("Delete")}
                                        </Dropdown.Button>
                                      </Dropdown.Item>
                                    </Dropdown.List>
                                  </Dropdown>
                                </Dropdown.TriggerContext>
                              ) : (
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
                                    variant="tertiary"
                                    data-size="sm"
                                    disabled={busy}
                                    onClick={() => {
                                      setConfirmingDeleteId(null)
                                      setAssigningId(item.id)
                                    }}
                                  >
                                    {t("Assign to...")}
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
                              )}
                            </>
                          )}
                        </List.Item>
                      )
                    })}
                  </List.Unordered>
                )}
              </div>
            )
          })}
        </Card.Block>
      </Card>
      <Dialog
        open={assigningItem != null}
        onClose={() => {
          setAssigningId(null)
        }}
      >
        <Dialog.Block>
          <Heading level={3} data-size="xs">
            {assigningItem?.name}
          </Heading>
          <Paragraph data-size="sm">{t("Assign to...")}</Paragraph>
        </Dialog.Block>
        <Dialog.Block>
          <div className={styles.assignChips}>
            {assigningItem != null &&
              userRows.map(u => (
                <Chip.Checkbox
                  key={u.id}
                  data-size="sm"
                  data-color="accent"
                  checked={assigningItem.assignee_ids.includes(u.id)}
                  onChange={e => {
                    toggleAssignee(assigningItem.id, u.id, e.target.checked)
                  }}
                >
                  {u.name}
                </Chip.Checkbox>
              ))}
          </div>
        </Dialog.Block>
        <Dialog.Block>
          <Button
            variant="tertiary"
            data-size="sm"
            onClick={() => {
              setAssigningId(null)
            }}
          >
            {t("Close")}
          </Button>
        </Dialog.Block>
      </Dialog>
    </>
  )
}
