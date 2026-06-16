import { Button, Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./SavedPolicies.module.css"
import { PolicySummary } from "./PolicySummary"
import {
  type Category,
  type EligibleOwner,
  type ExceptItem,
  type GroupWithMembers,
  type SplitPolicyConfig,
  type SplitPolicyOccupancy,
  type SplitPolicyParameter,
  type What,
  type When,
  type Who,
  normalizeParameters,
  resolveOccupancy,
} from "./types"

// NOTE: This type intentionally widens `how.kind` beyond the local `How` union
// to mirror the tRPC-inferred policy shape (which includes `by_ownership_pct`).
// The pre-existing type mismatch on `HOW_LABEL[rule.how.kind]` is preserved as
// flagged in the refactor plan.
type SavedRuleLike = {
  what: What
  how: { kind: "equally" | "weighted_by_occupancy" | "by_ownership_pct" }
  who: Who[] | Who
  except: ExceptItem[]
  when: When
}

type SavedFallbackLike = Omit<SavedRuleLike, "what">

export type SavedPolicy = {
  id: number
  name: string
  created_by_id: number
  created_by_name: string | null
  config: {
    parameters?: SplitPolicyParameter[]
    rules: SavedRuleLike[]
    fallback: SavedFallbackLike
    occupancy?: SplitPolicyOccupancy
  }
}

type CurrentUser = { id: number; is_admin: boolean } | null

type Props = {
  policies: SavedPolicy[]
  me: CurrentUser
  groups: GroupWithMembers[]
  categories: Category[]
  eligibleOwners: EligibleOwner[]
  propertyId: number
  propertyName: string
  pending: boolean
  onEdit: (policy: SavedPolicy) => void
  onDelete: (id: number, propertyId: number) => void
}

export function SavedPolicies({
  policies,
  me,
  groups,
  categories,
  eligibleOwners,
  propertyId,
  propertyName,
  pending,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation("settlement")
  return (
    <Card asChild>
      <section>
        <Heading level={4} data-size="2xs">
          {t("Saved policies")}
        </Heading>
        {policies.length === 0 ? (
          <Paragraph data-size="sm">{t("No custom policies yet.")}</Paragraph>
        ) : (
          policies.map(policy => {
            const canEdit =
              me != null && (policy.created_by_id === me.id || me.is_admin)
            return (
              <Card key={policy.id} asChild>
                <article>
                  <Card.Block data-size="sm">
                    <Heading level={5} data-size="2xs">
                      {policy.name}
                    </Heading>
                    <Paragraph data-size="sm">
                      {t("by")}{" "}
                      <strong>
                        {policy.created_by_name ??
                          t("user #{{id}}", {
                            id: String(policy.created_by_id),
                          })}
                      </strong>
                    </Paragraph>
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
                  </Card.Block>
                  {canEdit && (
                    <Card.Block data-size="sm">
                      <div className={styles.actions}>
                        <Button
                          type="button"
                          data-size="sm"
                          onClick={() => {
                            onEdit(policy)
                          }}
                          disabled={pending}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          data-size="sm"
                          onClick={() => {
                            onDelete(policy.id, propertyId)
                          }}
                          disabled={pending}
                        >
                          {t("Delete")}
                        </Button>
                      </div>
                    </Card.Block>
                  )}
                </article>
              </Card>
            )
          })
        )}
      </section>
    </Card>
  )
}
