import { Button, Card, Heading, Paragraph } from "@digdir/designsystemet-react"
import { Trans, useTranslation } from "react-i18next"
import {
  type Category,
  type EligibleOwner,
  type ExceptItem,
  type GroupWithMembers,
  HOW_LABEL,
  type What,
  type When,
  type Who,
  describeExcept,
  describeWhat,
  describeWhen,
  describeWhoList,
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
  include_extra_guests?: boolean
}

type SavedFallbackLike = Omit<SavedRuleLike, "what">

export type SavedPolicy = {
  id: number
  name: string
  created_by_id: number
  created_by_name: string | null
  config: {
    rules: SavedRuleLike[]
    fallback: SavedFallbackLike
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
  pending,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation("settlement")
  return (
    <>
      <Heading level={4} data-size="2xs">{t("Saved policies")}</Heading>
      <Paragraph data-size="sm">
        <em>
          <Trans
            ns="settlement"
            i18nKey="Live preview not yet implemented — the settlement engine still evaluates the built-in <code>occupancy_days</code> policy. These saved rules are persisted but not yet consumed by <code>computePreviewSplit</code>."
            components={{ code: <code /> }}
          />
        </em>
      </Paragraph>
      {policies.length === 0 ? (
        <Paragraph data-size="sm">{t("No custom policies yet.")}</Paragraph>
      ) : (
        policies.map(policy => {
          const canEdit = me != null
            && (policy.created_by_id === me.id || me.is_admin)
          return (
          <Card key={policy.id} asChild>
            <article>
              <Card.Block data-size="sm">
                <Heading level={5} data-size="2xs">{policy.name}</Heading>
                <Paragraph data-size="sm">
                  {t("by")}{" "}
                  <strong>
                    {policy.created_by_name ?? t("user #{{id}}", { id: String(policy.created_by_id) })}
                  </strong>
                </Paragraph>
                <ol>
                  {policy.config.rules.map((rule, i) => (
                    <li key={`${String(policy.id)}-${String(i)}`}>
                      {t("Split")} <strong>{describeWhat(rule.what, categories)}</strong>{" "}
                      <strong>{(t as (k: string) => string)(HOW_LABEL[rule.how.kind])}</strong> {t("between")}{" "}
                      <strong>{describeWhoList(Array.isArray(rule.who) ? rule.who : [rule.who], groups)}</strong> {t("who were")}{" "}
                      <strong>{describeWhen(rule.when, eligibleOwners)}</strong>
                      {rule.except.length > 0 && (
                        <>
                          {" "}{t("except")}{" "}
                          {rule.except
                            .map(e => describeExcept(e, groups))
                            .join(", ")}
                        </>
                      )}
                      {rule.include_extra_guests && (
                        <> · <em>{t("includes extra guests")}</em></>
                      )}
                    </li>
                  ))}
                  <li>
                    <em>{t("Default:")}</em> {t("split the rest")}{" "}
                    <strong>{(t as (k: string) => string)(HOW_LABEL[policy.config.fallback.how.kind])}</strong>{" "}
                    {t("between")}{" "}
                    <strong>
                      {describeWhoList(Array.isArray(policy.config.fallback.who) ? policy.config.fallback.who : [policy.config.fallback.who], groups)}
                    </strong>{" "}
                    {t("who were")}{" "}
                    <strong>
                      {describeWhen(policy.config.fallback.when, eligibleOwners)}
                    </strong>
                    {policy.config.fallback.except.length > 0 && (
                      <>
                        {" "}{t("except")}{" "}
                        {policy.config.fallback.except
                          .map(e => describeExcept(e, groups))
                          .join(", ")}
                      </>
                    )}
                    {policy.config.fallback.include_extra_guests && (
                      <> · <em>{t("includes extra guests")}</em></>
                    )}
                  </li>
                </ol>
              </Card.Block>
              {canEdit && (
                <Card.Block data-size="sm">
                  <Button
                    type="button"
                    data-size="sm"
                    onClick={() => { onEdit(policy) }}
                    disabled={pending}
                  >
                    {t("Edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => { onDelete(policy.id, propertyId) }}
                    disabled={pending}
                  >
                    {t("Delete")}
                  </Button>
                </Card.Block>
              )}
            </article>
          </Card>
          )
        })
      )}
    </>
  )
}
