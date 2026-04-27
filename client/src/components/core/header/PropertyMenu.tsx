import { type SyntheticEvent, useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import {
  selectSelectedPropertyId,
  setSelectedPropertyId,
} from "@/features/property/propertySlice"
import { selectSelectedUserId } from "@/features/user/userSlice"
import { loadAuth } from "@/auth/oauth"
import PropertySwitcher from "./PropertySwitcher.tsx"
import styles from "./Header.module.css"

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export default function PropertyMenu() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const auth = loadAuth()
  const selectedUserId = useAppSelector(selectSelectedUserId)
  const { data: properties, isLoading } = useQuery(
    trpc.property.listForUser.queryOptions(
      { user_id: selectedUserId ?? 0 },
      { enabled: auth.isAuthenticated && selectedUserId != null },
    ),
  )
  const selectedId = useAppSelector(selectSelectedPropertyId)
  const dispatch = useAppDispatch()

  const list = properties ?? []

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(p => p.id === selectedId)
    if (!stillExists) {
      dispatch(setSelectedPropertyId(list[0].id))
    }
  }, [list, selectedId, dispatch])

  const [isAddOpen, setIsAddOpen] = useState(false)

  const createProperty = useMutation(
    trpc.property.create.mutationOptions({
      onSuccess: created => {
        void qc.invalidateQueries({ queryKey: trpc.property.list.queryKey() })
        void qc.invalidateQueries({
          queryKey: trpc.property.listForUser.queryKey(),
        })
        dispatch(setSelectedPropertyId(created.id))
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
    createProperty.mutate({ name, address: "—" })
  }

  const current = list.find(p => p.id === selectedId)

  if (!auth.isAuthenticated) {
    return <div className={styles.menu} />
  }

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = current.name
  } else {
    label = "No property"
  }

  return (
    <div className={styles.menu}>
      <span>{label}</span>
      <PropertySwitcher
        properties={list}
        value={selectedId}
        onChange={id => { dispatch(setSelectedPropertyId(id)) }}
        onAddClick={() => { setIsAddOpen(true) }}
      />
      {isAddOpen && (
        <form onSubmit={handleAdd}>
          <fieldset>
            <legend>New property</legend>
            <div>
              <label>
                Name
                <input type="text" name="name" required autoFocus />
              </label>
            </div>
            <div>
              <button type="submit" disabled={createProperty.isPending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsAddOpen(false) }}
                disabled={createProperty.isPending}
              >
                Cancel
              </button>
            </div>
            {createProperty.error && (
              <p role="alert">Error: {createProperty.error.message}</p>
            )}
          </fieldset>
        </form>
      )}
    </div>
  )
}