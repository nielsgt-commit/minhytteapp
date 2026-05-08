import { useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
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
  const navigate = useNavigate()

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

  const current = list.find(p => p.id === selectedId)

  if (!auth.isAuthenticated) {
    return <div className={styles.menu} />
  }

  let label: string
  if (isLoading) {
    label = "Loading…"
  } else if (current) {
    label = ""
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
        isAddOpen={isAddOpen}
        onAddOpenChange={setIsAddOpen}
        onAdd={name => { createProperty.mutate({ name, address: "—" }) }}
        onManageProperty={() => { void navigate({ to: "/manageproperty" }) }}
        onUserGroups={() => { void navigate({ to: "/usergroups" }) }}
        isAddPending={createProperty.isPending}
        addError={createProperty.error?.message ?? null}
      />
    </div>
  )
}