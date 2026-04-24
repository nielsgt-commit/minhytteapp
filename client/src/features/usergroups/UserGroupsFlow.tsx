import { type SyntheticEvent, useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc.ts"
import styles from "./UserGroupsFlow.module.css"

type OpenForm =
  | { kind: "create" }
  | { kind: "rename"; groupId: number }
  | { kind: "addMember"; groupId: number }
  | null

const ADD_USER_SENTINEL = "__add__"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export function UserGroupsFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())

  const invalidateGroups = () => {
    void qc.invalidateQueries({
      queryKey: trpc.userGroup.listWithMembers.queryKey(),
    })
    void qc.invalidateQueries({ queryKey: trpc.userGroup.list.queryKey() })
  }
  const invalidateUsers = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
  }

  const createGroup = useMutation(
    trpc.userGroup.create.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const updateGroup = useMutation(
    trpc.userGroup.update.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const deleteGroup = useMutation(
    trpc.userGroup.delete.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const addMember = useMutation(
    trpc.userGroup.addMember.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const removeMember = useMutation(
    trpc.userGroup.removeMember.mutationOptions({
      onSuccess: invalidateGroups,
    }),
  )
  const createUser = useMutation(trpc.user.create.mutationOptions())

  const [openForm, setOpenForm] = useState<OpenForm>(null)
  const [addingUserForGroup, setAddingUserForGroup] = useState<number | null>(
    null,
  )

  const lastError =
    createGroup.error ??
    updateGroup.error ??
    deleteGroup.error ??
    addMember.error ??
    removeMember.error ??
    createUser.error
  const pending =
    createGroup.isPending ||
    updateGroup.isPending ||
    deleteGroup.isPending ||
    addMember.isPending ||
    removeMember.isPending ||
    createUser.isPending

  const handleCreate = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    createGroup.mutate(
      { name, is_main: fdBoolean(fd, "is_main") },
      {
        onSuccess: () => {
          form.reset()
          setOpenForm(null)
        },
      },
    )
  }

  const handleRename = (groupId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      if (!name) return
      updateGroup.mutate(
        { id: groupId, name, is_main: fdBoolean(fd, "is_main") },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDelete = (groupId: number, groupName: string) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return
    deleteGroup.mutate(
      { id: groupId },
      { onSuccess: () => { setOpenForm(null) } },
    )
  }

  const handleAddMember = (groupId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const user_id = fdNumber(fd, "user_id")
      if (!Number.isFinite(user_id)) return
      addMember.mutate(
        { user_group_id: groupId, user_id },
        {
          onSuccess: () => {
            form.reset()
            setOpenForm(null)
          },
        },
      )
    }

  const handleCreateAndAddMember = (groupId: number) =>
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const form = e.currentTarget
      const fd = new FormData(form)
      const name = fdString(fd, "name").trim()
      if (!name) return
      const email = `pending-${String(Date.now())}@example.local`
      createUser.mutate(
        { name, email },
        {
          onSuccess: created => {
            invalidateUsers()
            if (!created) return
            addMember.mutate(
              { user_group_id: groupId, user_id: created.id },
              {
                onSuccess: () => {
                  form.reset()
                  setAddingUserForGroup(null)
                  setOpenForm(null)
                },
              },
            )
          },
        },
      )
    }

  const handleRemoveMember = (
    groupId: number,
    userId: number,
    userName: string,
  ) => {
    if (!window.confirm(`Remove ${userName} from this group?`)) return
    removeMember.mutate({ user_group_id: groupId, user_id: userId })
  }

  return (
    <section>
      <h2>User groups</h2>
      <p>
        Groups bundle users so you can assign group ownership on a property and
        roll up settlements. Deleting a group is blocked while it is in use.
      </p>

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpenForm(v => (v?.kind === "create" ? null : { kind: "create" }))
          }}
        >
          {openForm?.kind === "create" ? "Cancel" : "New group"}
        </button>
      </div>

      {openForm?.kind === "create" && (
        <form onSubmit={handleCreate}>
          <fieldset>
            <legend>New group</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required autoFocus />
              </label>
            </div>
            <div>
              <label>
                <input type="checkbox" name="is_main" />
                Main
              </label>
            </div>
            <div>
              <button type="submit" disabled={createGroup.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => { setOpenForm(null) }}
                disabled={createGroup.isPending}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {groups.length === 0 ? (
        <p>No groups yet.</p>
      ) : (
        <ul className={styles.groupList}>
          {groups.map(g => {
            const memberIds = new Set(g.members.map(m => m.user_id))
            const availableUsers = users.filter(u => !memberIds.has(u.id))
            const isRenaming =
              openForm?.kind === "rename" && openForm.groupId === g.id
            const isAddingMember =
              openForm?.kind === "addMember" && openForm.groupId === g.id
            return (
              <li key={g.id}>
                <h3>
                  {g.name}
                  {g.is_main && <small> (main)</small>}
                </h3>
                <p>
                  {g.members.length} member
                  {g.members.length === 1 ? "" : "s"}
                </p>

                <div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setOpenForm(v =>
                        v?.kind === "rename" && v.groupId === g.id
                          ? null
                          : { kind: "rename", groupId: g.id },
                      )
                    }}
                  >
                    {isRenaming ? "Cancel" : "Rename"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setOpenForm(v =>
                        v?.kind === "addMember" && v.groupId === g.id
                          ? null
                          : { kind: "addMember", groupId: g.id },
                      )
                    }}
                  >
                    {isAddingMember ? "Cancel" : "Add member"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { handleDelete(g.id, g.name) }}
                  >
                    Delete
                  </button>
                </div>

                {isRenaming && (
                  <form
                    onSubmit={handleRename(g.id)}
                    key={`rename-${String(g.id)}`}
                  >
                    <fieldset>
                      <legend>Edit group</legend>
                      <div>
                        <label>
                          Name
                          <input
                            type="text"
                            name="name"
                            defaultValue={g.name}
                            required
                          />
                        </label>
                      </div>
                      <div>
                        <label>
                          <input
                            type="checkbox"
                            name="is_main"
                            defaultChecked={g.is_main}
                          />
                          Main
                        </label>
                      </div>
                      <div>
                        <button type="submit" disabled={updateGroup.isPending}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenForm(null) }}
                          disabled={updateGroup.isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}

                {isAddingMember && addingUserForGroup !== g.id && (
                  <form
                    onSubmit={handleAddMember(g.id)}
                    key={`add-member-${String(g.id)}`}
                  >
                    <fieldset>
                      <legend>Add member to {g.name}</legend>
                      <div>
                        <label>
                          User
                          <select
                            name="user_id"
                            required
                            defaultValue=""
                            onChange={e => {
                              if (e.currentTarget.value === ADD_USER_SENTINEL) {
                                setAddingUserForGroup(g.id)
                              }
                            }}
                          >
                            <option value="" disabled>
                              Select user
                            </option>
                            {availableUsers.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                            <option value={ADD_USER_SENTINEL}>
                              + Add user
                            </option>
                          </select>
                        </label>
                      </div>
                      <div>
                        <button
                          type="submit"
                          disabled={
                            addMember.isPending || availableUsers.length === 0
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenForm(null) }}
                          disabled={addMember.isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}

                {isAddingMember && addingUserForGroup === g.id && (
                  <form
                    onSubmit={handleCreateAndAddMember(g.id)}
                    key={`create-user-${String(g.id)}`}
                  >
                    <fieldset>
                      <legend>Create user and add to {g.name}</legend>
                      <div>
                        <label>
                          Name
                          <input
                            type="text"
                            name="name"
                            required
                            autoFocus
                          />
                        </label>
                      </div>
                      <div>
                        <button
                          type="submit"
                          disabled={
                            createUser.isPending || addMember.isPending
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingUserForGroup(null) }}
                          disabled={
                            createUser.isPending || addMember.isPending
                          }
                        >
                          Back
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}

                {g.members.length === 0 ? (
                  <p>No members yet.</p>
                ) : (
                  <ul>
                    {g.members.map(m => (
                      <li key={m.user_id}>
                        {m.user_name}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            handleRemoveMember(g.id, m.user_id, m.user_name)
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}