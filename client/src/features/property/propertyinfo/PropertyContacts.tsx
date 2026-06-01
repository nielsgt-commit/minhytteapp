import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { type SyntheticEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ValidationMessage } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import section from "@/features/property/managePropertySection.module.css"
import { fdString } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useCanEdit } from "@/hooks/useCanEdit"
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

export default function PropertyContacts() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const property_id = useSelectedPropertyId()
  const canEdit = useCanEdit()

  const { data: contacts } = useQuery(
    trpc.propertyContact.listForProperty.queryOptions(
      { property_id: property_id ?? 0 },
      { enabled: property_id != null },
    ),
  )

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: trpc.propertyContact.listForProperty.queryKey(),
    })

  const createMutation = useMutation(
    trpc.propertyContact.create.mutationOptions({
      onSuccess: () => {
        void invalidate()
      },
    }),
  )
  const updateMutation = useMutation(
    trpc.propertyContact.update.mutationOptions({
      onSuccess: () => {
        void invalidate()
      },
    }),
  )
  const deleteMutation = useMutation(
    trpc.propertyContact.delete.mutationOptions({
      onSuccess: () => {
        void invalidate()
      },
    }),
  )

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const { pending, error: lastError } = useMutationsStatus(
    createMutation,
    updateMutation,
    deleteMutation,
  )

  if (property_id == null) return null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    createMutation.mutate(
      {
        property_id,
        name,
        phone: nullable(fdString(fd, "phone")),
        email: nullable(fdString(fd, "email")),
        info: nullable(fdString(fd, "info")),
      },
      {
        onSuccess: () => {
          form.reset()
          setIsAdding(false)
        },
      },
    )
  }

  const handleSave = (c: Contact) => (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fdString(fd, "name").trim()
    if (!name) return
    updateMutation.mutate(
      {
        id: c.id,
        property_id,
        name,
        phone: nullable(fdString(fd, "phone")),
        email: nullable(fdString(fd, "email")),
        info: nullable(fdString(fd, "info")),
      },
      {
        onSuccess: () => {
          setEditingId(null)
        },
      },
    )
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
      {lastError && (
        <ValidationMessage role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </ValidationMessage>
      )}

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
