import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { SelectionToast } from "./SelectionToast"
import styles from "./Header.module.css"

export function PropertyMenu() {
  const { t } = useTranslation("core")
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
  const [toast, setToast] = useState<string | null>(null)
  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  // Announce the active property on app open and whenever the app returns to
  // the foreground — but only for users with more than one property, where
  // "which property am I looking at?" is a real question.
  const currentName =
    list.length > 1 ? list.find(p => p.id === selectedId)?.name : undefined
  const hasAnnouncedRef = useRef(false)
  useEffect(() => {
    if (currentName === undefined) return
    if (!hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true
      setToast(t("You are viewing {{name}}", { name: currentName }))
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setToast(t("You are viewing {{name}}", { name: currentName }))
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [currentName, t])

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
          const selected = list.find(p => p.id === id)
          if (selected) {
            setToast(t("You are viewing {{name}}", { name: selected.name }))
          }
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
      {toast && <SelectionToast message={toast} onDismiss={dismissToast} />}
    </div>
  )
}
