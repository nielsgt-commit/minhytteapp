import { useSelectedPropertyId } from "@/selection/useSelection"
import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import {
  Button,
  Card,
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
import { useIsMobile } from "@/hooks/useIsMobile"
import {
  ALL_SECTIONS,
  type InventorySection,
} from "@server/shared/inventorySections.ts"

// A number input's raw value → optional positive quantity (empty/invalid → null).
function parseQuantity(raw: string): number | null {
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) || n < 1 ? null : n
}

// The list endpoint returns every inventory item on the property, so each list
// shows only its own sections' items; the "Other" fallback must exclude the
// sections of ALL lists or items would leak across the food/general boundary.
function isKnownSection(value: string): value is InventorySection {
  return (ALL_SECTIONS as readonly string[]).includes(value)
}

export function InventoryList({
  sections: ownSections,
  emptyStateTitle,
  showOtherGroup,
}: {
  sections: readonly InventorySection[]
  // Pre-translated by the wrapper.
  emptyStateTitle: string
  // Only one list may show the unknown-legacy-category group (the food list),
  // otherwise the same rows would be managed from two places.
  showOtherGroup: boolean
}) {
  const { t } = useTranslation("inventory")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useSelectedPropertyId()
  const isMobile = useIsMobile()

  const isOwnSection = (value: string): value is InventorySection =>
    (ownSections as readonly string[]).includes(value)

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
              category: vars.category,
              quantity: vars.quantity ?? null,
              location: vars.location ?? null,
              structure_id: vars.structure_id ?? null,
              room_id: vars.room_id ?? null,
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
                  ...(vars.category !== undefined && {
                    category: vars.category,
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

  if (isLoading || !items) {
    return <CardSkeleton />
  }

  const structureRows = structures ?? []
  const roomRows = rooms ?? []
  const structureById = new Map(structureRows.map(s => [s.id, s.name]))
  const roomById = new Map(roomRows.map(r => [r.id, r.name]))

  const handleAdd = (category: InventorySection) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    try {
      await createMutation.mutateAsync({
        property_id: selectedPropertyId,
        name,
        category,
      })
    } catch {
      // Surfaced via the aggregated ErrorAlert below.
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
    const category = fdString(fd, "category")
    if (!name || !isOwnSection(category)) return
    try {
      await updateMutation.mutateAsync({
        property_id: selectedPropertyId,
        id: item.id,
        name,
        category,
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

  // One group per fixed section, plus a trailing read-only group for any item
  // whose category predates the sections (or was edited outside the app).
  const sections: {
    key: InventorySection | null
    label: string
    items: typeof items
  }[] = ownSections.map(section => ({
    key: section,
    label: t(section),
    items: items.filter(i => i.category === section),
  }))
  const otherItems = showOtherGroup
    ? items.filter(i => !isKnownSection(i.category))
    : []
  if (otherItems.length > 0) {
    sections.push({ key: null, label: t("Other"), items: otherItems })
  }

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
          {sections.map(({ key, label, items: sectionItems }) => (
            <section key={key ?? "other"} className={styles.section}>
              <Heading level={3} data-size="2xs">
                {label}
              </Heading>
              {key != null && (
                <form action={handleAdd(key)} className={styles.addRow}>
                  <Textfield
                    aria-label={t("New item in {{section}}", {
                      section: label,
                    })}
                    name="name"
                    placeholder={t("Add item...")}
                  />
                  <SubmitButton>{t("Add")}</SubmitButton>
                </form>
              )}
              {sectionItems.length > 0 && (
                <List.Unordered className={styles.list}>
                  {sectionItems.map(renderItem)}
                </List.Unordered>
              )}
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
                  name="category"
                  defaultValue={
                    isOwnSection(editingItem.category)
                      ? editingItem.category
                      : ""
                  }
                  required
                >
                  {/* A legacy category shows as a disabled placeholder so
                      saving forces a pick of a real section. */}
                  {!isOwnSection(editingItem.category) && (
                    <Select.Option value="" disabled>
                      {editingItem.category}
                    </Select.Option>
                  )}
                  {ownSections.map(section => (
                    <Select.Option key={section} value={section}>
                      {t(section)}
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
