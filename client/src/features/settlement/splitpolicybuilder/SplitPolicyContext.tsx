import { createContext, useContext, type ReactNode } from "react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Card, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useSplitPolicyForm } from "./useSplitPolicyForm"
import type { SavedPolicy } from "./SavedPolicies"
import {
  type AllowedOptions,
  type Category,
  type EligibleOwner,
  type GroupWithMembers,
  type PropertyUser,
  allUsersInProperty,
  allowedHowKinds,
  allowedWhenKinds,
  allowedWindowKinds,
  allowsCategoryRules,
  allowsCustomParticipants,
  allowsExtraGuests,
  deriveParameters,
  sanitizeConfigForParameters,
} from "./types"

// The policy builder and the person-days panel live on separate child routes but
// must share one form instance (so an edit in one is visible in the other and a
// single save persists everything). The provider owns the form + queries +
// mutations and exposes them through context; both routes are thin consumers.
type Form = ReturnType<typeof useSplitPolicyForm>

type SplitPolicyContextValue = Form & {
  propertyId: number
  propertyName: string
  policies: SavedPolicy[]
  groups: GroupWithMembers[]
  categories: Category[]
  activeCategories: Category[]
  me: { id: number; is_admin: boolean } | null
  eligibleOwners: EligibleOwner[]
  propertyUsers: PropertyUser[]
  allowed: AllowedOptions
  pending: boolean
  error: { message: string } | null
  submitAction: () => Promise<void>
  // Persists just the occupancy of the loaded policy; null for an unsaved one.
  persistOccupancy: (() => Promise<void>) | null
  deletePolicy: (id: number, propertyId: number) => void
}

const Ctx = createContext<SplitPolicyContextValue | null>(null)

export function useSplitPolicyContext(): SplitPolicyContextValue {
  const value = useContext(Ctx)
  if (value == null) {
    throw new Error(
      "useSplitPolicyContext must be used within a SplitPolicyProvider",
    )
  }
  return value
}

type ProviderProps = {
  onSaved?: (policyId: number) => void
  children: ReactNode
}

export function SplitPolicyProvider({ onSaved, children }: ProviderProps) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const propertyName =
    properties.find(p => p.id === selectedPropertyId)?.name ?? ""
  const { data: policies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.listAllForDisplay.queryOptions({
      property_id: selectedPropertyId ?? 0,
    }),
  )
  const { data: me } = useSuspenseQuery(trpc.user.me.queryOptions())
  const { data: priorityData } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: selectedPropertyId ?? 0,
      year: Temporal.Now.plainDateISO().year,
    }),
  )
  const eligibleOwners: EligibleOwner[] = priorityData.eligibleOwners

  // After the queries so exclusion-pruning can resolve participants from the
  // live group membership and owner list.
  const formApi = useSplitPolicyForm(groups, eligibleOwners)

  const saveMutation = useMutationWithInvalidation(
    trpc.propertySplitPolicy.save.mutationOptions({
      onSuccess: saved => {
        formApi.reset()
        onSaved?.(saved.id)
      },
    }),
    [trpc.propertySplitPolicy.pathKey()],
  )
  const deleteMutation = useMutationWithInvalidation(
    trpc.propertySplitPolicy.delete.mutationOptions(),
    [trpc.propertySplitPolicy.pathKey()],
  )
  const updateOccupancyMutation = useMutationWithInvalidation(
    trpc.propertySplitPolicy.updateOccupancy.mutationOptions(),
    [trpc.propertySplitPolicy.pathKey()],
  )
  const status = useMutationsStatus(
    saveMutation,
    deleteMutation,
    updateOccupancyMutation,
  )

  if (selectedPropertyId == null) {
    return (
      <Card asChild>
        <section>
          <Paragraph>
            {t("Select a property to design custom split policies.")}
          </Paragraph>
        </section>
      </Card>
    )
  }

  const propertyId = selectedPropertyId
  const { form } = formApi
  const activeCategories = categories.filter(c => c.archived_at == null)

  const allowed: AllowedOptions = {
    howKinds: allowedHowKinds(form.parameters),
    whenKinds: allowedWhenKinds(form.parameters),
    windowKinds: allowedWindowKinds(form.parameters),
    priorityWeeks: form.parameters.includes("time_conditions"),
    categories: allowsCategoryRules(form.parameters),
    participants: allowsCustomParticipants(form.parameters),
    extraGuests: allowsExtraGuests(form.parameters),
  }

  const submitAction = async () => {
    const trimmedName = form.name.trim()
    if (trimmedName.length === 0) return
    // The builder exposes every option, so the saved parameter set is derived
    // from what the config actually uses (keeping booking_days/phases honest)
    // rather than from the always-full form.parameters.
    const config = sanitizeConfigForParameters({
      parameters: deriveParameters(form),
      rules: form.rules,
      fallback: form.fallback,
      occupancy: form.occupancy,
    })
    await saveMutation
      .mutateAsync({
        id: form.id ?? undefined,
        property_id: propertyId,
        name: trimmedName,
        config,
      })
      .catch(() => undefined)
  }

  // Rejects on failure (no swallowing) so the panel can stay in edit mode; the
  // error still surfaces through the shared mutation status / ErrorAlert.
  const persistOccupancy =
    form.id == null
      ? null
      : async () => {
          await updateOccupancyMutation.mutateAsync({
            id: form.id ?? 0,
            property_id: propertyId,
            occupancy: form.occupancy,
          })
        }

  const value: SplitPolicyContextValue = {
    ...formApi,
    propertyId,
    propertyName,
    policies,
    groups,
    categories,
    activeCategories,
    me,
    eligibleOwners,
    propertyUsers: allUsersInProperty(groups),
    allowed,
    pending: status.pending,
    error: status.error,
    submitAction,
    persistOccupancy,
    deletePolicy: (id, propId) => {
      deleteMutation.mutate({ id, property_id: propId })
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
