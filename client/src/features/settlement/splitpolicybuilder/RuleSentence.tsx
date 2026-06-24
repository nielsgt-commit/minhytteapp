import { Button, Chip, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { CategoryPicker } from "./CategoryPicker"
import { ExceptPicker } from "./ExceptPicker"
import { WhoPicker } from "./WhoPicker"
import styles from "./RuleSentence.module.css"
import {
  type AllowedOptions,
  type Category,
  type EligibleOwner,
  type ExceptItem,
  type GroupWithMembers,
  type How,
  HOW_LABEL,
  type PropertyUser,
  addCategory,
  categoryIds,
  nameForCategory,
  participantsFromWho,
  removeCategory,
  type What,
  type When,
  WHEN_LABEL,
  type Who,
  decodeWhen,
  describeExcept,
  describeWhat,
  describeWhen,
  describeWho,
  describeWhoList,
  encodeExcept,
  encodeWhen,
  encodeWho,
  normalizeWho,
} from "./types"

type SentenceRule = {
  what?: What
  how: { kind: How["kind"] }
  who: Who[] | Who
  except: ExceptItem[]
  when: When
}

// Presence of `edit` flips a clause from plain text to a control. Each clause
// also collapses to text on its own when the active parameters leave no real
// choice, and vacuous clauses (e.g. when = "anytime") disappear entirely.
export type RuleEdit = {
  allowed: AllowedOptions
  pending: boolean
  onPatch: (patch: Partial<{ what: What; how: How; when: When }>) => void
  onAddWho: (encoded: string) => void
  onRemoveWho: (encoded: string) => void
  onAddExcept: (encoded: string) => void
  onRemoveExcept: (encoded: string) => void
  onMove?: (delta: -1 | 1) => void
  onRemove?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

type Props = {
  rule: SentenceRule
  // Leading noun phrase for the default rule (rules with a `what` say
  // "Expenses from <category>" instead).
  subject: string
  groups: GroupWithMembers[]
  activeCategories: Category[]
  categories: Category[]
  propertyUsers: PropertyUser[]
  eligibleOwners: EligibleOwner[]
  propertyName: string
  // A short, illustrative "what this would pay out" line shown under the
  // sentence in the builder. Made-up sample numbers — see PolicySummary.
  example?: string
  edit?: RuleEdit
}

export function RuleSentence({
  rule,
  subject,
  groups,
  activeCategories,
  categories,
  propertyUsers,
  eligibleOwners,
  propertyName,
  example,
  edit,
}: Props) {
  const { t } = useTranslation("settlement")
  const tk = t as (k: string) => string
  const who = normalizeWho(rule.who)
  // Capture as a local so the add/remove closures below get a narrowed `What`
  // (TS won't narrow `rule.what` inside nested callbacks).
  const what = rule.what

  const whatLabel = (w: What) =>
    w.kind === "total"
      ? t("all categories (totals)")
      : describeWhat(w, categories)

  const howKinds = edit ? [...edit.allowed.howKinds] : [rule.how.kind]
  const showHowSelect = edit != null && howKinds.length > 1
  // Person-days already scope participation by stay (its own time window), so the
  // "who were at <property>" presence clause is redundant and hidden for it. The
  // how-select onChange also resets `when` to "always" so no stale presence
  // filter lingers in the saved config.
  const showWhenClause =
    rule.how.kind !== "weighted_by_occupancy" &&
    (edit ? edit.allowed.whenKinds.size > 1 : rule.when.kind !== "always")
  const participantsEditable = edit?.allowed.participants ?? false

  // You can only exclude someone who is actually a participant, so the exclude
  // picker is restricted to the people (and whole groups) the `who` resolves to —
  // e.g. "heads of this property" can't then exclude a non-head.
  const included = participantsFromWho(who, groups, eligibleOwners)
  const excludableUsers = propertyUsers.filter(u => included.userIds.has(u.user_id))
  const excludableGroups = groups.filter(g => included.groupIds.has(g.id))

  return (
    <div className={styles.rule}>
      <p className={styles.sentence}>
        {/* what */}
        {what != null ? (
          <>
            {t("Expenses from")}{" "}
            {edit != null ? (
              <>
                {categoryIds(what).map(id => (
                  <Chip.Removable
                    key={id}
                    type="button"
                    data-size="sm"
                    data-color="accent"
                    disabled={edit.pending}
                    aria-label={t("Remove {{name}}", {
                      name: nameForCategory(categories, id),
                    })}
                    onClick={() => {
                      edit.onPatch({ what: removeCategory(what, id) })
                    }}
                  >
                    {nameForCategory(categories, id)}
                  </Chip.Removable>
                ))}{" "}
                <CategoryPicker
                  categories={activeCategories}
                  selectedIds={new Set(categoryIds(what))}
                  onAdd={id => {
                    edit.onPatch({ what: addCategory(what, id) })
                  }}
                />{" "}
              </>
            ) : (
              <strong>{whatLabel(what)}</strong>
            )}{" "}
          </>
        ) : (
          <>{subject} </>
        )}
        {/* how */}
        {t("are split")}{" "}
        {showHowSelect ? (
          <Select
            aria-label={t("How to split")}
            data-size="sm"
            data-width="auto"
            value={rule.how.kind}
            disabled={edit.pending}
            onChange={e => {
              const kind = e.target.value as How["kind"]
              // Person-days carries its own time window, so drop any presence
              // clause when switching to it (the clause is hidden too).
              edit.onPatch(
                kind === "weighted_by_occupancy"
                  ? { how: { kind }, when: { kind: "always" } }
                  : { how: { kind } },
              )
            }}
          >
            {Object.entries(HOW_LABEL)
              .filter(([value]) => howKinds.includes(value as How["kind"]))
              .map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {tk(label)}
                </Select.Option>
              ))}
          </Select>
        ) : (
          <strong>{tk(HOW_LABEL[rule.how.kind])}</strong>
        )}{" "}
        {/* example (inline parenthetical, builder only) */}
        {example != null && (
          <span className={styles.example}>
            ({t("Example:")} {example}){" "}
          </span>
        )}
        {/* who */}
        {t("between")}{" "}
        {!participantsEditable || edit == null ? (
          <strong>{describeWhoList(who, groups)}</strong>
        ) : (
          <>
            {who.map(w => {
              const enc = encodeWho(w)
              return (
                <Chip.Removable
                  key={enc}
                  type="button"
                  data-size="sm"
                  data-color="accent"
                  disabled={edit.pending}
                  aria-label={t("Remove {{name}}", {
                    name: describeWho(w, groups),
                  })}
                  onClick={() => {
                    edit.onRemoveWho(enc)
                  }}
                >
                  {describeWho(w, groups)}
                </Chip.Removable>
              )
            })}{" "}
            <WhoPicker
              propertyUsers={propertyUsers}
              groups={groups}
              selectedEncoded={new Set(who.map(encodeWho))}
              onAdd={edit.onAddWho}
            />
          </>
        )}
        {/* when */}
        {showWhenClause && (
          <>
            {" "}
            {t("who were at {{property}}", { property: propertyName })}{" "}
            {edit != null ? (
              <Select
                aria-label={t("When present")}
                data-size="sm"
                data-width="auto"
                value={encodeWhen(rule.when)}
                disabled={edit.pending}
                onChange={e => {
                  edit.onPatch({ when: decodeWhen(e.target.value) })
                }}
              >
                {Object.entries(WHEN_LABEL)
                  .filter(([value]) =>
                    edit.allowed.whenKinds.has(
                      value as keyof typeof WHEN_LABEL,
                    ),
                  )
                  .map(([value, label]) => (
                    <Select.Option key={value} value={value}>
                      {tk(label)}
                    </Select.Option>
                  ))}
                {edit.allowed.whenKinds.has("present_priority_week") &&
                  eligibleOwners.length > 0 && (
                    <Select.Optgroup label={t("Specific priority week")}>
                      {eligibleOwners.map(o => {
                        const enc = `present_priority_week:${String(o.user_group_id)}`
                        return (
                          <Select.Option key={enc} value={enc}>
                            {t("{{name}}'s priority week", {
                              name: o.user_group_name,
                            })}
                          </Select.Option>
                        )
                      })}
                    </Select.Optgroup>
                  )}
              </Select>
            ) : (
              <strong>{describeWhen(rule.when, eligibleOwners)}</strong>
            )}
          </>
        )}
        {/* except */}
        {participantsEditable && edit != null ? (
          <>
            {" "}
            {t("except")}{" "}
            {rule.except.map(e => {
              const enc = encodeExcept(e)
              return (
                <Chip.Removable
                  key={enc}
                  type="button"
                  data-size="sm"
                  data-color="accent"
                  disabled={edit.pending}
                  aria-label={t("Remove {{name}}", {
                    name: describeExcept(e, groups),
                  })}
                  onClick={() => {
                    edit.onRemoveExcept(enc)
                  }}
                >
                  {describeExcept(e, groups)}
                </Chip.Removable>
              )
            })}{" "}
            <ExceptPicker
              propertyUsers={excludableUsers}
              groups={excludableGroups}
              selectedEncoded={new Set(rule.except.map(encodeExcept))}
              onAdd={edit.onAddExcept}
            />
          </>
        ) : rule.except.length > 0 ? (
          <>
            {" "}
            {t("except")}{" "}
            {rule.except.map(e => describeExcept(e, groups)).join(", ")}
          </>
        ) : null}
      </p>

      {edit != null && (edit.onMove != null || edit.onRemove != null) && (
        <div className={styles.controls}>
          {edit.onMove != null && (
            <>
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={!edit.canMoveUp || edit.pending}
                onClick={() => {
                  edit.onMove?.(-1)
                }}
              >
                {t("↑ Up")}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                disabled={!edit.canMoveDown || edit.pending}
                onClick={() => {
                  edit.onMove?.(1)
                }}
              >
                {t("↓ Down")}
              </Button>
            </>
          )}
          {edit.onRemove != null && (
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={edit.pending}
              onClick={() => {
                edit.onRemove?.()
              }}
            >
              {t("Remove rule")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
