import { type SyntheticEvent, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Card,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { useTRPC } from "@/trpc/trpc"

type Contact = {
  id: number
  property_id: number
  name: string
  phone: string | null
  email: string | null
  info: string | null
}

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

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

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: trpc.propertyContact.listForProperty.queryKey(),
    })

  const createMutation = useMutation(
    trpc.propertyContact.create.mutationOptions({
      onSuccess: () => { void invalidate() },
    }),
  )
  const updateMutation = useMutation(
    trpc.propertyContact.update.mutationOptions({
      onSuccess: () => { void invalidate() },
    }),
  )
  const deleteMutation = useMutation(
    trpc.propertyContact.delete.mutationOptions({
      onSuccess: () => { void invalidate() },
    }),
  )

  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  if (property_id == null) return null

  const lastError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  const editingContact = editingId
    ? contacts?.find(c => c.id === editingId) ?? null
    : null

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

  const handleSave =
    (c: Contact) => (e: SyntheticEvent<HTMLFormElement>) => {
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
        { onSuccess: () => { setEditingId(null) } },
      )
    }

  const handleDelete = (c: Contact) => {
    if (!window.confirm(`Remove contact "${c.name}"?`)) return
    deleteMutation.mutate(
      { id: c.id, property_id },
      { onSuccess: () => { setEditingId(null) } },
    )
  }

  return (
    <section>
      <h3>Property contacts</h3>

      <Switch
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.target.checked
          setEditMode(next)
          if (!next) {
            setEditingId(null)
            setIsAdding(false)
          }
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {editingContact ? (
        <form
          onSubmit={handleSave(editingContact)}
          key={`edit-${String(editingContact.id)}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <Textfield
            label="Name"
            name="name"
            required
            autoFocus
            maxLength={255}
            defaultValue={editingContact.name}
            disabled={updateMutation.isPending}
          />
          <Textfield
            label="Phone"
            name="phone"
            type="tel"
            maxLength={64}
            defaultValue={editingContact.phone ?? ""}
            disabled={updateMutation.isPending}
          />
          <Textfield
            label="Email"
            name="email"
            type="email"
            maxLength={255}
            defaultValue={editingContact.email ?? ""}
            disabled={updateMutation.isPending}
          />
          <Textfield
            label="Info"
            name="info"
            multiline
            rows={3}
            maxLength={1024}
            defaultValue={editingContact.info ?? ""}
            disabled={updateMutation.isPending}
          />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-color="danger"
              disabled={pending}
              onClick={() => { handleDelete(editingContact) }}
            >
              Remove
            </Button>
            <Button
              type="button"
              variant="tertiary"
              disabled={pending}
              onClick={() => { setEditingId(null) }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {contacts?.map(c => (
            <Card asChild key={c.id}>
              <li>
                <Card.Block
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
                  {editMode && (
                    <>
                      <Button
                        variant="tertiary"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { setEditingId(c.id) }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        data-color="danger"
                        data-size="sm"
                        disabled={pending}
                        onClick={() => { handleDelete(c) }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </Card.Block>
              </li>
            </Card>
          ))}

          <Card asChild key="__add">
            <li>
              <Card.Block
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {isAdding ? (
                  <>
                    <strong>Add contact</strong>
                    <form
                      onSubmit={handleAdd}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <Textfield
                        label="Name"
                        name="name"
                        required
                        autoFocus
                        maxLength={255}
                        disabled={createMutation.isPending}
                      />
                      <Textfield
                        label="Phone"
                        name="phone"
                        type="tel"
                        maxLength={64}
                        disabled={createMutation.isPending}
                      />
                      <Textfield
                        label="Email"
                        name="email"
                        type="email"
                        maxLength={255}
                        disabled={createMutation.isPending}
                      />
                      <Textfield
                        label="Info"
                        name="info"
                        multiline
                        rows={3}
                        maxLength={1024}
                        disabled={createMutation.isPending}
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <Button type="submit" disabled={createMutation.isPending}>
                          Add contact
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          disabled={createMutation.isPending}
                          onClick={() => { setIsAdding(false) }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <Button
                    variant="tertiary"
                    style={{
                      flex: 1,
                      minHeight: "4rem",
                      alignSelf: "stretch",
                    }}
                    disabled={pending}
                    onClick={() => { setIsAdding(true) }}
                  >
                    + Add contact
                  </Button>
                )}
              </Card.Block>
            </li>
          </Card>
        </ul>
      )}
    </section>
  )
}
