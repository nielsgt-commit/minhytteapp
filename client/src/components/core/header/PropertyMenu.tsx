import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import {
  useSelectedPropertyId,
  useSetSelectedPropertyId,
} from "@/selection/useSelection"
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
  const setSelectedPropertyId = useSetSelectedPropertyId()
  const navigate = useNavigate()

  const list = useMemo(() => properties ?? [], [properties])

  useEffect(() => {
    if (list.length === 0) return
    const stillExists = list.some(p => p.id === selectedId)
    if (!stillExists) {
      void setSelectedPropertyId(list[0].id, { replace: true })
    }
  }, [list, selectedId, setSelectedPropertyId])

  const [isAddOpen, setIsAddOpen] = useState(false)

  const createProperty = useMutation(
    trpc.property.create.mutationOptions({
      onSuccess: created => {
        void qc.invalidateQueries({ queryKey: trpc.property.mine.queryKey() })
        void setSelectedPropertyId(created.id)
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
          void setSelectedPropertyId(id)
        }}
        isAddOpen={isAddOpen}
        onAddOpenChange={setIsAddOpen}
        onAdd={name => {
          createProperty.mutate({ name, address: "—" })
        }}
        onManageProperty={() => {
          void navigate({ to: "/administrer" })
        }}
        isAddPending={createProperty.isPending}
        addError={createProperty.error?.message ?? null}
      />
    </div>
  )
}
