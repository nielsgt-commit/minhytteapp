import { useSuspenseQuery } from "@tanstack/react-query"
import { Temporal } from "temporal-polyfill"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import { useTRPC } from "@/trpc/trpc"
import { PolicySummary } from "./splitpolicybuilder/PolicySummary"
import type { SavedPolicy } from "./splitpolicybuilder/SavedPolicies"
import {
  type EligibleOwner,
  type SplitPolicyConfig,
  normalizeParameters,
  resolveOccupancy,
} from "./splitpolicybuilder/types"

// Read-only inline rendering of a saved policy's rules, reused from the policy
// builder's PolicySummary. Mounted only when the progress summary expands the
// details, so its supporting queries don't run on every settlement view.
export function SettlementSplitPolicyDetails({
  propertyId,
  policy,
}: {
  propertyId: number
  policy: SavedPolicy
}) {
  return (
    <QueryBoundary>
      <SettlementSplitPolicyDetailsContent
        propertyId={propertyId}
        policy={policy}
      />
    </QueryBoundary>
  )
}

function SettlementSplitPolicyDetailsContent({
  propertyId,
  policy,
}: {
  propertyId: number
  policy: SavedPolicy
}) {
  const trpc = useTRPC()
  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.listAllForDisplay.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: priorityData } = useSuspenseQuery(
    trpc.priority.list.queryOptions({
      property_id: propertyId,
      year: Temporal.Now.plainDateISO().year,
    }),
  )

  const propertyName = properties.find(p => p.id === propertyId)?.name ?? ""
  const eligibleOwners: EligibleOwner[] = priorityData.eligibleOwners

  return (
    <PolicySummary
      parameters={policy.config.parameters}
      rules={policy.config.rules}
      fallback={policy.config.fallback}
      occupancy={resolveOccupancy(
        policy.config as unknown as SplitPolicyConfig,
        normalizeParameters(policy.config.parameters),
      )}
      groups={groups}
      categories={categories}
      eligibleOwners={eligibleOwners}
      propertyName={propertyName}
    />
  )
}
