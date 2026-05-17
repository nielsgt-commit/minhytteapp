import { Button, Card, Heading, Paragraph } from "@digdir/designsystemet-react"
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
  return (
    <>
      <Heading level={4} data-size="2xs">Saved policies</Heading>
      <Paragraph data-size="sm">
        <em>Live preview not yet implemented — the settlement engine still
        evaluates the built-in <code>occupancy_days</code> policy. These
        saved rules are persisted but not yet consumed by{" "}
        <code>computePreviewSplit</code>.</em>
      </Paragraph>
      {policies.length === 0 ? (
        <Paragraph data-size="sm">No custom policies yet.</Paragraph>
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
                  by{" "}
                  <strong>
                    {policy.created_by_name ?? `user #${String(policy.created_by_id)}`}
                  </strong>
                </Paragraph>
                <ol>
                  {policy.config.rules.map((rule, i) => (
                    <li key={`${String(policy.id)}-${String(i)}`}>
                      Split <strong>{describeWhat(rule.what, categories)}</strong>{" "}
                      <strong>{HOW_LABEL[rule.how.kind]}</strong> between{" "}
                      <strong>{describeWhoList(Array.isArray(rule.who) ? rule.who : [rule.who], groups)}</strong> who were{" "}
                      <strong>{describeWhen(rule.when, eligibleOwners)}</strong>
                      {rule.except.length > 0 && (
                        <>
                          {" "}except{" "}
                          {rule.except
                            .map(e => describeExcept(e, groups))
                            .join(", ")}
                        </>
                      )}
                      {rule.include_extra_guests && (
                        <> · <em>includes extra guests</em></>
                      )}
                    </li>
                  ))}
                  <li>
                    <em>Default:</em> split the rest{" "}
                    <strong>{HOW_LABEL[policy.config.fallback.how.kind]}</strong>{" "}
                    between{" "}
                    <strong>
                      {describeWhoList(Array.isArray(policy.config.fallback.who) ? policy.config.fallback.who : [policy.config.fallback.who], groups)}
                    </strong>{" "}
                    who were{" "}
                    <strong>
                      {describeWhen(policy.config.fallback.when, eligibleOwners)}
                    </strong>
                    {policy.config.fallback.except.length > 0 && (
                      <>
                        {" "}except{" "}
                        {policy.config.fallback.except
                          .map(e => describeExcept(e, groups))
                          .join(", ")}
                      </>
                    )}
                    {policy.config.fallback.include_extra_guests && (
                      <> · <em>includes extra guests</em></>
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
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => { onDelete(policy.id, propertyId) }}
                    disabled={pending}
                  >
                    Delete
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
