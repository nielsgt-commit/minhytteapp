import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTRPC } from "@/trpc/trpc"
import {
  useSelectedPropertyId,
  useSetSelectedPropertyId,
} from "@/selection/useSelection"
import { useAuthSession } from "@/auth/auth-client"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { PropertySwitcher } from "./PropertySwitcher"
import styles from "./Header.module.css"

export function PropertyMenu() {
  const trpc = useTRPC()
  const auth = useAuthSession()
  const { data: properties } = useQuery(
    trpc.property.mine.queryOptions(undefined, {
      enabled: auth.isAuthenticated,
    }),
  )
  const selectedId = useSelectedPropertyId()
  const setSelectedPropertyId = useSetSelectedPropertyId()
  const navigate = useNavigate()

  const list = properties ?? []

  useEffect(() => {
    if (!properties || properties.length === 0) return
    const stillExists = properties.some(p => p.id === selectedId)
    if (!stillExists) {
      void setSelectedPropertyId(properties[0].id, { replace: true })
    }
  }, [properties, selectedId, setSelectedPropertyId])

  const [isAddOpen, setIsAddOpen] = useState(false)

  const createProperty = useMutationWithInvalidation(
    trpc.property.create.mutationOptions({
      onSuccess: created => {
        void setSelectedPropertyId(created.id)
        setIsAddOpen(false)
      },
    }),
    [trpc.property.mine.queryKey()],
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
