import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Paragraph, Tag, ValidationMessage } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { fdNumber } from "@/utils/formData"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useToggleState } from "@/hooks/useToggleState"
import { useCanEdit } from "@/hooks/useCanEdit"
import {
  ownerLabel,
  ownershipOffBy,
  totalOwnershipPct,
} from "./ownershipCalculations.ts"
import { OwnerListView } from "./OwnerListView.tsx"
import { OwnerAddForm } from "./OwnerAddForm.tsx"
import section from "@/features/property/managePropertySection.module.css"

type AddKind = "user" | "group"

type Owner = {
  id: number
  user_group_id: number | null
  user_group_name: string | null
  ownership_pct: number | string
}

export function PropertyOwnersPanel() {
  const { t } = useTranslation("property")
  const trpc = useTRPC()
  const canEdit = useCanEdit()

  const selectedPropertyId = useSelectedPropertyId()

  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
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
      <div className={section.column}>
        <Paragraph>
          {t("No property selected. Pick one from the header.")}
        </Paragraph>
      </div>
    )
  }

  const owners = ownersQuery.data

  const totalPct = totalOwnershipPct(owners)
  const offBy = ownershipOffBy(owners)

  // Owners are group-only; adding a user resolves to that user's family
  // group server-side. We dedup on group id (uniqueness is enforced there);
  // a user whose group is already an owner is filtered out below.
  const takenGroupIds = new Set(owners.map(o => o.user_group_id))
  const availableUsers = users.filter(u => {
    const userGroupId = groups.find(g =>
      g.members.some(m => m.user_id === u.id),
    )?.id
    return userGroupId == null || !takenGroupIds.has(userGroupId)
  })
  const availableGroups = groups.filter(g => !takenGroupIds.has(g.id))

  const handlePctSave = (o: Owner, pct: number) => {
    updatePct.mutate({
      id: o.id,
      property_id: selectedPropertyId,
      ownership_pct: pct,
    })
  }

  const handleAddSubmit = async (fd: FormData) => {
    const pct = fdNumber(fd, "ownership_pct")
    if (!Number.isFinite(pct)) return
    try {
      if (addKind === "user") {
        const user_id = fdNumber(fd, "user_id")
        if (!Number.isFinite(user_id)) return
        await addUser.mutateAsync({
          property_id: selectedPropertyId,
          user_id,
          ownership_pct: pct,
        })
      } else {
        const user_group_id = fdNumber(fd, "user_group_id")
        if (!Number.isFinite(user_group_id)) return
        await addGroup.mutateAsync({
          property_id: selectedPropertyId,
          user_group_id,
          ownership_pct: pct,
        })
      }
      adding.close()
    } catch {
      /* surfaced via useMutationsStatus lastError */
    }
  }

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
    <div className={section.column}>
      <Paragraph>
        <Trans
          t={t}
          i18nKey="Total: <1>{{total}}%</1> "
          values={{ total: totalPct.toFixed(2) }}
          components={{ 1: <strong /> }}
        />
        {offBy > 0.001 && (
          <Tag data-color="danger" role="alert">
            {t("(does not sum to 100%)")}
          </Tag>
        )}
      </Paragraph>

      {lastError && (
        <ValidationMessage>
          {t("Error: {{message}}", { message: lastError.message })}
        </ValidationMessage>
      )}

      {adding.value ? (
        <OwnerAddForm
          addKind={addKind}
          pending={pending}
          addDisabled={addDisabled}
          availableUsers={availableUsers}
          availableGroups={availableGroups}
          totalGroups={groups.length}
          onKindChange={kind => {
            setAddKind(kind)
          }}
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
    </div>
  )
}
