import { type SyntheticEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button, List, Textfield } from "@digdir/designsystemet-react"

type Category = { id: number; name: string }

type Props = {
  category: Category
  total: number
  isEditing: boolean
  editingName: string
  onEditingNameChange: (value: string) => void
  onRenameSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  renamePending: boolean
  archivePending: boolean
  showAdmin: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onArchive: () => void
}

export function CategoryListItem({
  category,
  total,
  isEditing,
  editingName,
  onEditingNameChange,
  onRenameSubmit,
  renamePending,
  archivePending,
  showAdmin,
  onStartEdit,
  onCancelEdit,
  onArchive,
}: Props) {
  const { t } = useTranslation("expenses")
  return (
    <List.Item>
      {isEditing ? (
        <form onSubmit={onRenameSubmit}>
          <Textfield
            label={t("Category name")}
            value={editingName}
            onChange={e => { onEditingNameChange(e.target.value) }}
            maxLength={64}
            autoFocus
            required
          />
          <Button type="submit" disabled={renamePending}>
            {t("Save")}
          </Button>
          <Button
            variant="secondary"
            disabled={renamePending}
            onClick={onCancelEdit}
          >
            {t("Cancel")}
          </Button>
        </form>
      ) : (
        <>
          {category.name} - {total}
          {showAdmin && (
            <>
              <Button
                variant="tertiary"
                onClick={onStartEdit}
              >
                {t("Rename")}
              </Button>
              <Button
                variant="tertiary"
                data-color="danger"
                disabled={archivePending}
                onClick={onArchive}
              >
                {t("Remove")}
              </Button>
            </>
          )}
        </>
      )}
    </List.Item>
  )
}
