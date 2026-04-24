import { type SyntheticEvent, useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import {
  selectSelectedUserId,
  setSelectedUserId,
} from "@/features/user/userSlice"
import UserSwitcher from "./UserSwitcher"
import styles from "./Header.module.css"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export default function UserMenu() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data: users, isLoading } = useQuery(trpc.user.list.queryOptions())
  const selectedId = useAppSelector(selectSelectedUserId)
  const dispatch = useAppDispatch()

  const [isAddOpen, setIsAddOpen] = useState(false)

  const list = users ?? []

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(u => u.id === selectedId)
    if (!stillExists) {
      dispatch(setSelectedUserId(list[0].id))
    }
  }, [list, selectedId, dispatch])

  const createUser = useMutation(
    trpc.user.create.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: trpc.user.list.queryKey() })
        setIsAddOpen(false)
      },
    }),
  )

  const handleAdd = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = fdString(fd, "name").trim()
    if (!name) return
    const email = `pending-${String(Date.now())}@example.local`
    createUser.mutate({ name, email })
  }

  const current = list.find(u => u.id === selectedId)

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = current.name
  } else {
    label = "No user"
  }

  return (
    <div className={styles.menu}>
      <span>{label}</span>
      <UserSwitcher
        users={list}
        value={selectedId}
        onChange={id => { dispatch(setSelectedUserId(id)) }}
        onAddClick={() => { setIsAddOpen(true) }}
      />
      {isAddOpen && (
        <form onSubmit={handleAdd}>
          <fieldset>
            <legend>New user</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required autoFocus />
              </label>
            </div>
            <div>
              <button type="submit" disabled={createUser.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsAddOpen(false) }}
                disabled={createUser.isPending}
              >
                Cancel
              </button>
            </div>
            {createUser.error && (
              <p role="alert">Error: {createUser.error.message}</p>
            )}
          </fieldset>
        </form>
      )}
    </div>
  )
}