import { useSelectedUserId, useSelectedPropertyId } from "@/app/useSelectedIds"
import { useEffect, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useAppDispatch } from "@/app/hooks"
import { setSelectedPropertyId } from "@/features/property/propertySlice"
import { useAuthSession } from "@/auth/auth-client"
import PropertySwitcher from "./PropertySwitcher.tsx"
import styles from "./Header.module.css"

export default function PropertyMenu() {
  const { t } = useTranslation("core")
  const trpc = useTRPC()
  const qc = useQueryClient()
  const auth = useAuthSession()
  const selectedUserId = useSelectedUserId()
  const { data: properties, isLoading } = useQuery(
    trpc.property.listForUser.queryOptions(
      { user_id: selectedUserId ?? 0 },
      { enabled: auth.isAuthenticated && selectedUserId != null },
    ),
  )
  const selectedId = useSelectedPropertyId()
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
    label = t("Loading…")
  } else if (current) {
    label = ""
  } else {
    label = t("No property")
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
        isAddPending={createProperty.isPending}
        addError={createProperty.error?.message ?? null}
      />
    </div>
  )
}