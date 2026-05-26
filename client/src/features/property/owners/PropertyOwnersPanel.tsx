import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Trans, useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdNumber } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { useFormSubmit } from "@/hooks/useFormSubmit"
import { useCanEdit } from "@/hooks/useCanEdit"
import {
  ownerLabel,
  ownershipOffBy,
  totalOwnershipPct,
} from "./ownershipCalculations.ts"
import { OwnerListView } from "./OwnerListView.tsx"
import { OwnerAddForm } from "./OwnerAddForm.tsx"

type AddKind = "user" | "group"

type Owner = {
  id: number
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
}

export function PropertyOwnersPanel() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const canEdit = useCanEdit()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembers.queryOptions(),
  )

  const ownersQuery = useSuspenseQuery(
    trpc.propertyOwner.list.queryOptions(
      { property_id: selectedPropertyId ?? 0 },
      { enabled: selectedPropertyId != null },
    ),
  )

  const ownerKeys = [
    trpc.propertyOwner.list.queryKey({
      property_id: selectedPropertyId ?? 0,
    }),
  ]
  const addUser = useMutationWithInvalidation(
    trpc.propertyOwner.addUser.mutationOptions(),
    ownerKeys,
  )
  const addGroup = useMutationWithInvalidation(
    trpc.propertyOwner.addGroup.mutationOptions(),
    ownerKeys,
  )
  const updatePct = useMutationWithInvalidation(
    trpc.propertyOwner.updatePct.mutationOptions(),
    ownerKeys,
  )
  const removeOwner = useMutationWithInvalidation(
    trpc.propertyOwner.remove.mutationOptions(),
    ownerKeys,
  )

  const adding = useToggleState()
  const [addKind, setAddKind] = useState<AddKind>("user")

  const { pending, error: lastError } = useMutationsStatus(
    addUser,
    addGroup,
    updatePct,
    removeOwner,
  )

  if (selectedPropertyId == null) {
    return (
      <section>
        <h3>{t("Property Owners")}</h3>
        <p>{t("No property selected. Pick one from the header.")}</p>
      </section>
    )
  }

  const owners = ownersQuery.data

  const totalPct = totalOwnershipPct(owners)
  const offBy = ownershipOffBy(owners)

  const takenUserIds = new Set(
    owners.filter(o => o.user_id != null).map(o => o.user_id as number),
  )
  const takenGroupIds = new Set(
    owners
      .filter(o => o.user_group_id != null)
      .map(o => o.user_group_id as number),
  )
  const availableUsers = users.filter(u => !takenUserIds.has(u.id))
  const availableGroups = groups.filter(g => !takenGroupIds.has(g.id))

  const handlePctSave = (o: Owner, pct: number) => {
    updatePct.mutate({
      id: o.id,
      property_id: selectedPropertyId,
      ownership_pct: pct,
    })
  }

  const handleAddSubmit = useFormSubmit(
    fd => {
      const pct = fdNumber(fd, "ownership_pct")
      if (!Number.isFinite(pct)) return null
      if (addKind === "user") {
        const user_id = fdNumber(fd, "user_id")
        if (!Number.isFinite(user_id)) return null
        return { kind: "user" as const, user_id, ownership_pct: pct }
      }
      const user_group_id = fdNumber(fd, "user_group_id")
      if (!Number.isFinite(user_group_id)) return null
      return {
        kind: "group" as const,
        user_group_id,
        ownership_pct: pct,
      }
    },
    payload => {
      if (payload.kind === "user") {
        addUser.mutate(
          {
            property_id: selectedPropertyId,
            user_id: payload.user_id,
            ownership_pct: payload.ownership_pct,
          },
          { onSuccess: adding.close },
        )
      } else {
        addGroup.mutate(
          {
            property_id: selectedPropertyId,
            user_group_id: payload.user_group_id,
            ownership_pct: payload.ownership_pct,
          },
          { onSuccess: adding.close },
        )
      }
    },
  )

  const handleRemove = (o: Owner) => {
    const label = ownerLabel(o)
    if (!window.confirm(t("Remove {{label}} as owner?", { label }))) return
    removeOwner.mutate({ id: o.id, property_id: selectedPropertyId })
  }

  const addDisabled =
    pending ||
    (addKind === "user" && availableUsers.length === 0) ||
    (addKind === "group" && availableGroups.length === 0)

  return (
    <section>
      <h3>{t("Property Owners")}</h3>

      <p>
        <Trans
          t={t}
          i18nKey="Total: <1>{{total}}%</1> "
          values={{ total: totalPct.toFixed(2) }}
          components={{ 1: <strong /> }}
        />
        {offBy > 0.001 && (
          <strong role="alert">{t("(does not sum to 100%)")}</strong>
        )}
      </p>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {adding.value ? (
        <OwnerAddForm
          addKind={addKind}
          pending={pending}
          addDisabled={addDisabled}
          availableUsers={availableUsers}
          availableGroups={availableGroups}
          totalGroups={groups.length}
          onKindChange={kind => { setAddKind(kind) }}
          onSubmit={handleAddSubmit}
          onCancel={adding.close}
        />
      ) : (
        <OwnerListView
          owners={owners}
          canEdit={canEdit}
          pending={pending}
          onPctSave={handlePctSave}
          onRemove={handleRemove}
          onStartAdd={adding.open}
        />
      )}
    </section>
  )
}
