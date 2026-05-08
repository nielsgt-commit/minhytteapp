import { type SyntheticEvent, useState, useEffect } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { AssignedTasks } from "@/features/maintenance/AssignedTasks.tsx"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export function UserSettings() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: me } = useQuery(trpc.user.me.queryOptions())
  const { data: children } = useQuery(trpc.user.listMyChildren.queryOptions())

  const [name, setName] = useState("")
  useEffect(() => {
    if (me) setName(me.name)
  }, [me])

  const [birthday, setBirthday] = useState("")
  useEffect(() => {
    if (me) setBirthday(me.birthday ?? "")
  }, [me])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState("")

  const invalidateChildren = () =>
    qc.invalidateQueries({ queryKey: trpc.user.listMyChildren.queryKey() })

  const updateName = useMutation(
    trpc.user.updateMyName.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.user.me.queryKey() })
      },
    }),
  )

  const updateIsHead = useMutation(
    trpc.user.updateMyIsHead.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.user.me.queryKey() })
      },
    }),
  )

  const updateBirthday = useMutation(
    trpc.user.updateMyBirthday.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.user.me.queryKey() })
      },
    }),
  )

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

  const handleNameSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === me?.name) return
    updateName.mutate({ name: trimmed })
  }

  const handleBirthdaySubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = birthday.trim() || null
    if (next === (me?.birthday ?? null)) return
    updateBirthday.mutate({ birthday: next })
  }

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

  if (!me) return <p>Loading…</p>

  return (
    <section>
      <h1>User settings</h1>


      <form onSubmit={handleNameSubmit}>
        <fieldset>
          <legend>Display name</legend>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value) }}
              required
            />
          </label>
          <button
            type="submit"
            disabled={updateName.isPending || name.trim() === me.name}
          >
            Save
          </button>
          {updateName.error && (
            <p role="alert">Error: {updateName.error.message}</p>
          )}
        </fieldset>
      </form>

      <form onSubmit={handleBirthdaySubmit}>
        <fieldset>
          <legend>Birthday</legend>
          <label>
            Birthday
            <input
              type="date"
              value={birthday}
              onChange={e => { setBirthday(e.target.value) }}
            />
          </label>
          <button
            type="submit"
            disabled={
              updateBirthday.isPending ||
              (birthday.trim() || null) === (me.birthday ?? null)
            }
          >
            Save
          </button>
          {updateBirthday.error && (
            <p role="alert">Error: {updateBirthday.error.message}</p>
          )}
        </fieldset>
      </form>

      <fieldset>
        <legend>Household role</legend>
        <label>
          <input
            type="checkbox"
            checked={me.is_head}
            disabled={updateIsHead.isPending}
            onChange={e => {
              updateIsHead.mutate({ is_head: e.target.checked })
            }}
          />
          I am a household head (can be assigned a priority week and settlement)
        </label>
        {updateIsHead.error && (
          <p role="alert">Error: {updateIsHead.error.message}</p>
        )}
      </fieldset>

      <section>
        <h2>My children</h2>
        {children && children.length > 0 ? (
          <ul>
            {children.map(c => (
              <li key={c.id}>
                {editingId === c.id ? (
                  <form onSubmit={e => { handleEditSubmit(e, c.id) }}>
                    <input
                      type="text"
                      value={editDraft}
                      onChange={e => { setEditDraft(e.target.value) }}
                      required
                      autoFocus
                    />
                    <button type="submit" disabled={updateChild.isPending}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null) }}
                      disabled={updateChild.isPending}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => { startEdit(c.id, c.name) }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleRemove(c.id, c.name) }}
                      disabled={removeChild.isPending}
                    >
                      Remove
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No children yet.</p>
        )}
        {(updateChild.error ?? removeChild.error) && (
          <p role="alert">
            Error: {updateChild.error?.message ?? removeChild.error?.message}
          </p>
        )}

        <form onSubmit={handleAddChild}>
          <fieldset>
            <legend>Add child</legend>
            <label>
              Name
              <input type="text" name="name" required />
            </label>
            <button type="submit" disabled={createChild.isPending}>
              Add
            </button>
            {createChild.error && (
              <p role="alert">Error: {createChild.error.message}</p>
            )}
          </fieldset>
        </form>
      </section>
    </section>
  )
}