import { useSelectedPropertyId } from "@/selection/useSelection"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import section from "@/components/layouts/manageSection.module.css"
import { fdString } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useCanEdit } from "@/hooks/useCanEdit"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { ContactListView } from "./ContactListView.tsx"
import { ContactEditForm } from "./ContactEditForm.tsx"
import { ContactAddForm } from "./ContactAddForm.tsx"

type Contact = {
  id: number
  property_id: number
  name: string
  phone: string | null
  email: string | null
  info: string | null
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function PropertyContacts() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const property_id = useSelectedPropertyId()
  const canEdit = useCanEdit()

  const { data: contacts } = useQuery(
    trpc.propertyContact.listForProperty.queryOptions(
      { property_id: property_id ?? 0 },
      { enabled: property_id != null },
    ),
  )

  const contactKeys = [trpc.propertyContact.listForProperty.queryKey()]
  const createMutation = useMutationWithInvalidation(
    trpc.propertyContact.create.mutationOptions(),
    contactKeys,
  )
  const updateMutation = useMutationWithInvalidation(
    trpc.propertyContact.update.mutationOptions(),
    contactKeys,
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.propertyContact.delete.mutationOptions(),
    contactKeys,
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  if (property_id == null) return null

  const handleAdd = async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    try {
      await createMutation.mutateAsync({
        property_id,
        name,
        phone: nullable(fdString(fd, "phone")),
        email: nullable(fdString(fd, "email")),
        info: nullable(fdString(fd, "info")),
      })
      setIsAdding(false)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleSave = (c: Contact) => async (fd: FormData) => {
    const name = fdString(fd, "name").trim()
    if (!name) return
    try {
      await updateMutation.mutateAsync({
        id: c.id,
        property_id,
        name,
        phone: nullable(fdString(fd, "phone")),
        email: nullable(fdString(fd, "email")),
        info: nullable(fdString(fd, "info")),
      })
      setEditingId(null)
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

  const handleDelete = (c: Contact) => {
    if (!window.confirm(t('Remove contact "{{name}}"?', { name: c.name })))
      return
    deleteMutation.mutate(
      { id: c.id, property_id },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
  }

  return (
    <div className={section.column}>
      <ErrorAlert error={lastError} />

      <ContactListView
        contacts={contacts}
        canEdit={canEdit}
        pending={pending}
        isAdding={isAdding}
        editingId={editingId}
        onEdit={id => {
          setEditingId(id)
        }}
        onDelete={handleDelete}
        onStartAdd={() => {
          setIsAdding(true)
        }}
        renderEditForm={c => (
          <ContactEditForm
            contact={c}
            pending={pending}
            updatePending={updateMutation.isPending}
            onSubmit={handleSave(c)}
            onDelete={() => {
              handleDelete(c)
            }}
            onCancel={() => {
              setEditingId(null)
            }}
          />
        )}
        addSlot={
          <ContactAddForm
            createPending={createMutation.isPending}
            onSubmit={handleAdd}
            onCancel={() => {
              setIsAdding(false)
            }}
          />
        }
      />
    </div>
  )
}
