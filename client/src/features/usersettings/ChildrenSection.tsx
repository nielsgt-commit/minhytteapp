import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  Button,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
import { ErrorAlert } from "./ErrorAlert"

export function ChildrenSection() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: children } = useQuery(trpc.user.listMyChildren.queryOptions())

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState("")

  const invalidateChildren = () =>
    qc.invalidateQueries({ queryKey: trpc.user.listMyChildren.queryKey() })

  const createChild = useMutation(
    trpc.user.createChild.mutationOptions({
      onSuccess: () => { void invalidateChildren() },
    }),
  )

  const updateChild = useMutation(
    trpc.user.updateChild.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
        void invalidateChildren()
      },
    }),
  )

  const removeChild = useMutation(
    trpc.user.removeChild.mutationOptions({
      onSuccess: () => { void invalidateChildren() },
    }),
  )

  const handleAddChild = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const childName = fdString(fd, "name").trim()
    if (!childName) return
    createChild.mutate(
      { name: childName },
      { onSuccess: () => { form.reset() } },
    )
  }

  const startEdit = (id: number, currentName: string) => {
    setEditingId(id)
    setEditDraft(currentName)
  }

  const handleEditSubmit = (e: SyntheticEvent<HTMLFormElement>, id: number) => {
    e.preventDefault()
    const trimmed = editDraft.trim()
    if (!trimmed) return
    updateChild.mutate({ id, name: trimmed })
  }

  const handleRemove = (id: number, childName: string) => {
    if (!window.confirm(`Remove ${childName}?`)) return
    removeChild.mutate({ id })
  }

  return (
    <section>
      <h2>My children (under 13)</h2>
      {children && children.length > 0 ? (
        <ul>
          {children.map(c => (
            <li key={c.id}>
              {editingId === c.id ? (
                <form onSubmit={e => { handleEditSubmit(e, c.id) }}>
                  <Textfield
                    label="Name"
                    type="text"
                    value={editDraft}
                    onChange={e => { setEditDraft(e.target.value) }}
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={updateChild.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setEditingId(null) }}
                    disabled={updateChild.isPending}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span>{c.name}</span>
                  <Button
                    type="button"
                    onClick={() => { startEdit(c.id, c.name) }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { handleRemove(c.id, c.name) }}
                    disabled={removeChild.isPending}
                  >
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No children yet.</p>
      )}
      <ErrorAlert error={updateChild.error ?? removeChild.error} />

      <form onSubmit={handleAddChild}>
        <Fieldset>
          <Fieldset.Legend>Add child (under 13)</Fieldset.Legend>
          <Textfield label="Name" type="text" name="name" required />
          <Button type="submit" disabled={createChild.isPending}>
            Add
          </Button>
          <ErrorAlert error={createChild.error} />
        </Fieldset>
      </form>
    </section>
  )
}
