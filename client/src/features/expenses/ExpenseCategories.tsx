import { useSelectedPropertyId } from "@/app/useSelectedIds"
import { type SyntheticEvent, useState } from "react"
import {
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, List, Switch, Textfield, ValidationMessage } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import type { ExpenseRow } from "./types.ts"
import { useCategoryTotals } from "./useCategoryTotals.ts"
import { useCategoryAdminMutations } from "./useCategoryAdminMutations.ts"
import { CategoryListItem } from "./CategoryListItem.tsx"
import { useTRPC } from "@/trpc/trpc"

export function ExpenseCategories() {
  const { t } = useTranslation("expenses")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const { data: expenses } = useSuspenseQuery(
    trpc.expense.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions(),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const [editMode, setEditMode] = useState(false)

  const {
    create,
    rename,
    archive,
    newName,
    setNewName,
    editingId,
    editingName,
    setEditingName,
    startEdit,
    cancelEdit,
  } = useCategoryAdminMutations()

  const { perCategory, uncategorized } = useCategoryTotals(
    expenses as ExpenseRow[],
    categories,
  )

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    create.mutate({ name })
  }

  const handleRename = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editingId == null) return
    const name = editingName.trim()
    if (!name) return
    rename.mutate({ id: editingId, name })
  }

  return (
    <section>
      <h3>{t("Expense categories")}</h3>
      {me?.is_head && (
        <Switch
          label={t("Edit mode")}
          checked={editMode}
          onChange={e => {
            const next = e.target.checked
            setEditMode(next)
            if (!next) {
              cancelEdit()
            }
          }}
        />
      )}
      <List.Unordered>
        <List.Item>{t("(no category)")} - {uncategorized}</List.Item>
        {categories.map(c => (
          <CategoryListItem
            key={c.id}
            category={c}
            total={perCategory.get(c.name) ?? 0}
            isEditing={editMode && editingId === c.id}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onRenameSubmit={handleRename}
            renamePending={rename.isPending}
            archivePending={archive.isPending}
            showAdmin={editMode && (me?.is_head ?? false)}
            onStartEdit={() => { startEdit(c.id, c.name) }}
            onCancelEdit={cancelEdit}
            onArchive={() => { archive.mutate({ id: c.id }) }}
          />
        ))}
      </List.Unordered>
      {editMode && me?.is_head && (
        <form onSubmit={handleAdd}>
          <Textfield
            label={t("New category")}
            value={newName}
            onChange={e => { setNewName(e.target.value) }}
            maxLength={64}
            required
          />
          <Button type="submit" disabled={create.isPending}>
            {t("Add")}
          </Button>
        </form>
      )}
      {create.error && (
        <ValidationMessage>{t("Error: {{message}}", { message: create.error.message })}</ValidationMessage>
      )}
      {rename.error && (
        <ValidationMessage>{t("Error: {{message}}", { message: rename.error.message })}</ValidationMessage>
      )}
      {archive.error && (
        <ValidationMessage>{t("Error: {{message}}", { message: archive.error.message })}</ValidationMessage>
      )}
    </section>
  )
}
