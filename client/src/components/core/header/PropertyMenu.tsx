import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch } from "@/app/hooks"
import { setSelectedPropertyId } from "@/features/property/propertySlice"
import { useAuthSession } from "@/auth/auth-client"
import PropertySwitcher from "./PropertySwitcher.tsx"
import styles from "./Header.module.css"

export default function PropertyMenu() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const auth = useAuthSession()
  const { data: properties } = useQuery(
    trpc.property.mine.queryOptions(undefined, {
      enabled: auth.isAuthenticated,
    }),
  )
  const selectedId = useSelectedPropertyId()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const list = useMemo(() => properties ?? [], [properties])

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
        void qc.invalidateQueries({ queryKey: trpc.property.mine.queryKey() })
        dispatch(setSelectedPropertyId(created.id))
        setIsAddOpen(false)
      },
    }),
  )

  if (!auth.isAuthenticated) {
    return <div className={styles.menu} />
  }

  return (
    <div className={styles.menu}>
      <PropertySwitcher
        properties={list}
        value={selectedId}
        onChange={id => {
          dispatch(setSelectedPropertyId(id))
        }}
        isAddOpen={isAddOpen}
        onAddOpenChange={setIsAddOpen}
        onAdd={name => {
          createProperty.mutate({ name, address: "—" })
        }}
        onManageProperty={() => {
          void navigate({ to: "/manageproperty" })
        }}
        isAddPending={createProperty.isPending}
        addError={createProperty.error?.message ?? null}
      />
    </div>
  )
}
