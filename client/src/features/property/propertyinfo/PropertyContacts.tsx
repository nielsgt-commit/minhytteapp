import { type SyntheticEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type ContactDraft = {
  name: string
  phone: string
  email: string
  info: string
}

const emptyDraft: ContactDraft = { name: "", phone: "", email: "", info: "" }

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export default function PropertyContacts() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const property_id = useAppSelector(selectSelectedPropertyId)

  const { data: contacts } = useQuery(
    trpc.propertyContact.listForProperty.queryOptions(
      { property_id: property_id ?? 0 },
      { enabled: property_id != null },
    ),
  )

  const [draft, setDraft] = useState<ContactDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState<ContactDraft>(emptyDraft)
  const [editMode, setEditMode] = useState(false)

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: trpc.propertyContact.listForProperty.queryKey(),
    })

  const createMutation = useMutation(
    trpc.propertyContact.create.mutationOptions({
      onSuccess: () => {
        setDraft(emptyDraft)
        void invalidate()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.propertyContact.update.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
        setEditingDraft(emptyDraft)
        void invalidate()
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.propertyContact.delete.mutationOptions({
      onSuccess: () => { void invalidate() },
    }),
  )

  if (property_id == null) return null

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    createMutation.mutate({
      property_id,
      name,
      phone: nullable(draft.phone),
      email: nullable(draft.email),
      info: nullable(draft.info),
    })
  }

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (editingId == null) return
    const name = editingDraft.name.trim()
    if (!name) return
    updateMutation.mutate({
      id: editingId,
      property_id,
      name,
      phone: nullable(editingDraft.phone),
      email: nullable(editingDraft.email),
      info: nullable(editingDraft.info),
    })
  }

  return (
    <section>
      <h3>Property contacts</h3>

      <label>
        <input
          type="checkbox"
          checked={editMode}
          onChange={e => {
            const next = e.currentTarget.checked
            setEditMode(next)
            if (!next) {
              setEditingId(null)
              setEditingDraft(emptyDraft)
            }
          }}
        />
        Edit mode
      </label>

      <ul>
        {contacts?.map(c => (
          <li key={c.id}>
            {editMode && editingId === c.id ? (
              <form onSubmit={handleSave}>
                <label>
                  Name
                  <input
                    type="text"
                    value={editingDraft.name}
                    onChange={e => { setEditingDraft({ ...editingDraft, name: e.target.value }) }}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={editingDraft.phone}
                    onChange={e => { setEditingDraft({ ...editingDraft, phone: e.target.value }) }}
                    maxLength={64}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={editingDraft.email}
                    onChange={e => { setEditingDraft({ ...editingDraft, email: e.target.value }) }}
                    maxLength={255}
                  />
                </label>
                <label>
                  Info
                  <textarea
                    value={editingDraft.info}
                    onChange={e => { setEditingDraft({ ...editingDraft, info: e.target.value }) }}
                    maxLength={1024}
                  />
                </label>
                <button type="submit" disabled={updateMutation.isPending}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    setEditingId(null)
                    setEditingDraft(emptyDraft)
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <strong>{c.name}</strong>
                {c.phone && <> — {c.phone}</>}
                {c.email && <> — {c.email}</>}
                {c.info && <> — {c.info}</>}
                {editMode && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id)
                        setEditingDraft({
                          name: c.name,
                          phone: c.phone ?? "",
                          email: c.email ?? "",
                          info: c.info ?? "",
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        deleteMutation.mutate({ id: c.id, property_id })
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {editMode && (
      <form onSubmit={handleAdd}>
        <h4>Add contact</h4>
        <label>
          Name
          <input
            type="text"
            value={draft.name}
            onChange={e => { setDraft({ ...draft, name: e.target.value }) }}
            maxLength={255}
            required
          />
        </label>
        <label>
          Phone
          <input
            type="tel"
            value={draft.phone}
            onChange={e => { setDraft({ ...draft, phone: e.target.value }) }}
            maxLength={64}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={draft.email}
            onChange={e => { setDraft({ ...draft, email: e.target.value }) }}
            maxLength={255}
          />
        </label>
        <label>
          Info
          <textarea
            value={draft.info}
            onChange={e => { setDraft({ ...draft, info: e.target.value }) }}
            maxLength={1024}
          />
        </label>
        <button type="submit" disabled={createMutation.isPending}>
          Add
        </button>
      </form>
      )}

      {createMutation.error && (
        <p role="alert">Error: {createMutation.error.message}</p>
      )}
      {updateMutation.error && (
        <p role="alert">Error: {updateMutation.error.message}</p>
      )}
      {deleteMutation.error && (
        <p role="alert">Error: {deleteMutation.error.message}</p>
      )}
    </section>
  )
}