import { useSelectedPropertyId } from "@/selection/useSelection"
import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import {
  Button,
  Card,
  Chip,
  Dialog,
  Dropdown,
  Field,
  Heading,
  Label,
  List,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { MenuElipsisVerticalIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./InventoryList.module.css"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { CardSkeleton } from "@/components/shared/query-states/CardSkeleton"
import { EmptyState } from "@/components/shared/query-states/EmptyState"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData"
import { formatDateTime } from "@/utils/dateUtils"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  sortInventoryCategories,
  type InventoryCategoryKind,
} from "@server/shared/inventoryCategoryDefaults.ts"

// A number input's raw value → optional positive quantity (empty/invalid → null).
function parseQuantity(raw: string): number | null {
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) || n < 1 ? null : n
}

export function InventoryList({
  kind,
  emptyStateTitle,
}: {
  // Which lists' categories (and thus items) this list shows: the food
  // inventory on /handleliste or the general one on /inventar.
  kind: InventoryCategoryKind
  // Pre-translated by the wrapper.
  emptyStateTitle: string
}) {
  const { t, i18n } = useTranslation("inventory")
  // Category names are dynamic keys: the seeded defaults have translations,
  // user-created names render verbatim via defaultValue.
  const tName = t as (key: string, options?: { defaultValue: string }) => string
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()

  const listKey = trpc.inventoryItem.listForProperty.queryKey({
    property_id: selectedPropertyId ?? 0,
  })

  const { data: items, isLoading } = useQuery(
    trpc.inventoryItem.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      {
        enabled: selectedPropertyId != null,
        // Concurrent users see each other's stock updates near-live.
        refetchInterval: 15_000,
      },
    ),
  )
  const { data: categories } = useQuery(
    trpc.inventoryCategory.list.queryOptions(
      { property_id: selectedPropertyId ?? 0, kind },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: users } = useQuery(
    trpc.user.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: structures } = useQuery(
    trpc.structure.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )
  const { data: rooms } = useQuery(
    trpc.room.listForProperty.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const inventoryKeys = [trpc.inventoryItem.pathKey()]
  // Optimistic add so the new item appears immediately. The temp id is larger
  // than any existing id so it lands where the real (serial) id will.
  const createMutation = useMutationWithInvalidation(
    trpc.inventoryItem.create.mutationOptions({
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
              name: vars.name,
              category_id: vars.category_id,
              // The categories query is necessarily loaded — the add row the
              // user submitted was rendered from it.
              category:
                categories?.find(c => c.id === vars.category_id)?.name ?? "",
              kind,
              quantity: vars.quantity ?? null,
              location: vars.location ?? null,
              structure_id: vars.structure_id ?? null,
              room_id: vars.room_id ?? null,
              created_at: Temporal.Now.instant(),
              created_by: me?.id ?? null,
              updated_at: null,
              updated_by: null,
            },
          ]
        })
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(listKey, ctx.previous)
      },
    }),
    inventoryKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.inventoryItem.update.mutationOptions({
      onMutate: async vars => {
        await qc.cancelQueries({ queryKey: listKey })
        const previous = qc.getQueryData(listKey)
        qc.setQueryData(listKey, old =>
          old?.map(i =>
            i.id === vars.id
              ? {
                  ...i,
                  ...(vars.name !== undefined && { name: vars.name }),
                  // kind can't change from this page (only same-kind
                  // categories are offered), so it stays as-is.
                  ...(vars.category_id !== undefined && {
                    category_id: vars.category_id,
                    category:
                      categories?.find(c => c.id === vars.category_id)?.name ??
                      i.category,
                  }),
                  ...("quantity" in vars && {
                    quantity: vars.quantity ?? null,
                  }),
                  ...("location" in vars && {
                    location: vars.location ?? null,
                  }),
                  ...("structure_id" in vars && {
                    structure_id: vars.structure_id ?? null,
                  }),
                  ...("room_id" in vars && { room_id: vars.room_id ?? null }),
                  updated_at: Temporal.Now.instant(),
                  updated_by: me?.id ?? null,
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
    inventoryKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.inventoryItem.delete.mutationOptions(),
    inventoryKeys,
  )

  const { error } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  const busy = deleteMutation.isPending

  // The edit dialog's building/room selects are controlled so a room pick can
  // derive the building and a building change can clear a now-foreign room.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBuildingId, setEditBuildingId] = useState<number | null>(null)
  const [editRoomId, setEditRoomId] = useState<number | null>(null)

  // Two-tap delete: first tap arms, second confirms; armed state auto-clears.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  )
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  // Quick-add: one input for the whole list; typing reveals the category
  // chips and tapping one saves to that category. The last-used category is
  // remembered so Enter repeats it for same-category streaks.
  const [draft, setDraft] = useState("")
  const [lastCategoryId, setLastCategoryId] = useState<number | null>(null)
  const quickAddInputRef = useRef<HTMLInputElement>(null)

  // After a save the draft clears, which would hide the chips instantly —
  // too fast to see which chip got checked. A short linger keeps them (and
  // the checked state) visible as confirmation. Counter, not boolean, so a
  // rapid next save restarts the timer.
  const [chipLinger, setChipLinger] = useState(0)
  useEffect(() => {
    if (chipLinger === 0) return
    const timer = setTimeout(() => {
      setChipLinger(0)
    }, 400)
    return () => {
      clearTimeout(timer)
    }
  }, [chipLinger])

  useEffect(() => {
    if (confirmingDeleteId == null) return
    const timer = setTimeout(() => {
      setConfirmingDeleteId(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [confirmingDeleteId])

  if (selectedPropertyId == null) {
    return <EmptyState title={emptyStateTitle} />
  }

  if (isLoading || !items || !categories) {
    return <CardSkeleton />
  }

  const structureRows = structures ?? []
  const roomRows = rooms ?? []
  const structureById = new Map(structureRows.map(s => [s.id, s.name]))
  const roomById = new Map(roomRows.map(r => [r.id, r.name]))
  const userById = new Map((users ?? []).map(u => [u.id, u.name]))

  // Fire-and-forget so the input is immediately ready for the next item; the
  // optimistic cache row shows the item and a failure rolls back + surfaces
  // via the aggregated ErrorAlert.
  const quickAdd = (categoryId: number) => {
    const name = draft.trim()
    if (!name) return
    setDraft("")
    setLastCategoryId(categoryId)
    setChipLinger(n => n + 1)
    quickAddInputRef.current?.focus()
    createMutation
      .mutateAsync({
        property_id: selectedPropertyId,
        name,
        category_id: categoryId,
      })
      .catch(() => undefined)
  }

  // Enter repeats the last-used category; before any chip has been tapped
  // there is no target, so Enter keeps the draft and does nothing.
  const submitToLastCategory = () => {
    if (
      lastCategoryId != null &&
      categories.some(c => c.id === lastCategoryId)
    ) {
      quickAdd(lastCategoryId)
    }
  }

  const handleDelete = (id: number) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      setMenuOpenId(null)
      deleteMutation.mutate({ id })
    } else {
      setConfirmingDeleteId(id)
    }
  }

  const openEdit = (item: (typeof items)[number]) => {
    setConfirmingDeleteId(null)
    setMenuOpenId(null)
    setEditBuildingId(item.structure_id)
    setEditRoomId(item.room_id)
    setEditingId(item.id)
  }

  const handleSave = (item: (typeof items)[number]) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    const categoryId = Number(fdString(fd, "category_id"))
    if (!name || !Number.isInteger(categoryId) || categoryId < 1) return
    try {
      await updateMutation.mutateAsync({
        property_id: selectedPropertyId,
        id: item.id,
        name,
        category_id: categoryId,
        quantity: parseQuantity(fdString(fd, "quantity")),
        location: fdString(fd, "location").trim() || null,
        structure_id: editBuildingId,
        room_id: editRoomId,
      })
      setEditingId(null)
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
    }
  }

  const editingItem =
    editingId == null ? undefined : items.find(i => i.id === editingId)

  // One group per category of this list's kind, defaults first in canonical
  // order (server orders by id, which drifts for properties whose rows were
  // created lazily pre-seed), then custom categories by creation.
  const orderedCategories = sortInventoryCategories(categories)
  const sections = orderedCategories.map(category => ({
    id: category.id,
    label: tName(category.name, { defaultValue: category.name }),
    items: items.filter(i => i.category_id === category.id),
  }))

  // Most recently touched item across THIS list's sections (an edit counts,
  // and so does adding: a never-edited item's stamp is its creation).
  const touchedAt = (item: (typeof items)[number]) =>
    item.updated_at ?? item.created_at
  const lastTouched = sections
    .flatMap(s => s.items)
    .reduce<
      (typeof items)[number] | null
    >((latest, item) => (latest == null || Temporal.Instant.compare(touchedAt(item), touchedAt(latest)) > 0 ? item : latest), null)
  const lastTouchedByName =
    lastTouched == null
      ? undefined
      : userById.get(lastTouched.updated_by ?? lastTouched.created_by ?? -1)

  const renderItem = (item: (typeof items)[number]) => {
    const meta = [
      item.quantity != null ? `× ${String(item.quantity)}` : null,
      item.location,
      item.structure_id != null ? structureById.get(item.structure_id) : null,
      item.room_id != null ? roomById.get(item.room_id) : null,
    ].filter((part): part is string => part != null && part !== "")
    return (
      <List.Item className={styles.row} key={item.id}>
        <div className={styles.textCol}>
          <Paragraph className={styles.name} data-size="sm">
            {item.name}
          </Paragraph>
          {meta.length > 0 && (
            <Paragraph className={styles.meta} data-size="sm">
              {meta.join(" · ")}
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
                setMenuOpenId(menuOpenId === item.id ? null : item.id)
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
                      openEdit(item)
                    }}
                  >
                    {t("Edit")}
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
                openEdit(item)
              }}
            >
              {t("Edit")}
            </Button>
            <Button
              variant={confirmingDeleteId === item.id ? "primary" : "tertiary"}
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
      </List.Item>
    )
  }

  return (
    <>
      <ErrorAlert error={error} />
      <Card>
        <Card.Block className={styles.body}>
          <form
            className={styles.quickAdd}
            onSubmit={e => {
              // Fallback for submit paths that skip the keydown (e.g. a
              // virtual keyboard's Go button).
              e.preventDefault()
              submitToLastCategory()
            }}
          >
            <Textfield
              ref={quickAddInputRef}
              aria-label={t("New item")}
              placeholder={t("Add item...")}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitToLastCategory()
                }
              }}
            />
            {(draft.trim() !== "" || chipLinger > 0) && (
              <div
                className={styles.chipRow}
                role="radiogroup"
                aria-label={t("Save to category")}
              >
                {/* Chip.Radio so the remembered (Enter-repeat) category gets
                    the design system's checked styling. Saving happens in
                    onClick, which — unlike onChange — also fires when tapping
                    the already-checked chip again. */}
                {sections.map(({ id, label }) => (
                  <Chip.Radio
                    key={id}
                    name="quickadd-category"
                    value={String(id)}
                    data-size="sm"
                    checked={lastCategoryId === id}
                    onChange={() => undefined}
                    onClick={() => {
                      quickAdd(id)
                    }}
                  >
                    {label}
                  </Chip.Radio>
                ))}
              </div>
            )}
          </form>
          {lastTouched != null && (
            <Paragraph className={styles.lastUpdated} data-size="xs">
              {lastTouchedByName != null
                ? t("Last updated {{time}} by {{user}} – {{item}}", {
                    time: formatDateTime(touchedAt(lastTouched), i18n.language),
                    user: lastTouchedByName,
                    item: lastTouched.name,
                  })
                : t("Last updated {{time}} – {{item}}", {
                    time: formatDateTime(touchedAt(lastTouched), i18n.language),
                    item: lastTouched.name,
                  })}
            </Paragraph>
          )}
          {/* Empty categories stay reachable through the chips; a bare
              heading with nothing under it is just clutter. */}
          {sections
            .filter(({ items: sectionItems }) => sectionItems.length > 0)
            .map(({ id, label, items: sectionItems }) => (
              <section key={id} className={styles.section}>
                <Heading level={3} data-size="2xs">
                  {label}
                </Heading>
                <List.Unordered className={styles.list}>
                  {sectionItems.map(renderItem)}
                </List.Unordered>
              </section>
            ))}
        </Card.Block>
      </Card>
      <Dialog
        open={editingItem != null}
        onClose={() => {
          setEditingId(null)
        }}
      >
        {editingItem != null && (
          <form
            action={handleSave(editingItem)}
            className={styles.editForm}
            key={editingItem.id}
          >
            <Dialog.Block>
              <Heading level={3} data-size="xs">
                {t("Edit item")}
              </Heading>
            </Dialog.Block>
            <Dialog.Block className={styles.editFields}>
              <Textfield
                label={t("Name")}
                name="name"
                defaultValue={editingItem.name}
                required
              />
              <Field>
                <Label>{t("Category")}</Label>
                <Select
                  name="category_id"
                  defaultValue={String(editingItem.category_id)}
                  required
                >
                  {orderedCategories.map(category => (
                    <Select.Option
                      key={category.id}
                      value={String(category.id)}
                    >
                      {tName(category.name, { defaultValue: category.name })}
                    </Select.Option>
                  ))}
                </Select>
              </Field>
              <Textfield
                label={t("Quantity")}
                name="quantity"
                type="number"
                min={1}
                step={1}
                defaultValue={editingItem.quantity ?? ""}
              />
              <Textfield
                label={t("Location")}
                name="location"
                defaultValue={editingItem.location ?? ""}
              />
              <Field>
                <Label>{t("Building")}</Label>
                <Select
                  value={editBuildingId == null ? "" : String(editBuildingId)}
                  onChange={e => {
                    const next =
                      e.target.value === "" ? null : Number(e.target.value)
                    setEditBuildingId(next)
                    // A room in another building can't survive the switch.
                    setEditRoomId(null)
                  }}
                >
                  <Select.Option value="">{t("None")}</Select.Option>
                  {structureRows.map(s => (
                    <Select.Option key={s.id} value={String(s.id)}>
                      {s.name}
                    </Select.Option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>{t("Room")}</Label>
                <Select
                  value={editRoomId == null ? "" : String(editRoomId)}
                  disabled={editBuildingId == null}
                  onChange={e => {
                    setEditRoomId(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }}
                >
                  <Select.Option value="">{t("None")}</Select.Option>
                  {roomRows
                    .filter(r => r.structure_id === editBuildingId)
                    .map(r => (
                      <Select.Option key={r.id} value={String(r.id)}>
                        {r.name}
                      </Select.Option>
                    ))}
                </Select>
              </Field>
            </Dialog.Block>
            <Dialog.Block className={styles.dialogActions}>
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
            </Dialog.Block>
          </form>
        )}
      </Dialog>
    </>
  )
}
