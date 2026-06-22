import { Button, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { RuleSentence, type RuleEdit } from "./RuleSentence"
import { OccupancyCounting } from "./OccupancyCounting"
import styles from "./PolicySummary.module.css"
import {
  type AllowedOptions,
  type Category,
  type EligibleOwner,
  type ExceptItem,
  type GroupWithMembers,
  type How,
  PARAMETER_LABEL,
  type PropertyUser,
  type SplitPolicyOccupancy,
  type SplitPolicyParameter,
  type What,
  type When,
  type Who,
  normalizeParameters,
  normalizeWho,
} from "./types"

// Sample total used for the illustrative example lines under each rule in the
// builder. Round number → clean made-up splits that build trust in the calc.
const SAMPLE_AMOUNT = 1000

// Accepts both the live builder form (who: Who[]) and the tRPC-inferred saved
// policy shape (who: Who[] | Who, how.kind widened) so SavedPolicies and the
// live editor render identical sentences from one place.
type SummaryRule = {
  what: What
  how: { kind: How["kind"] }
  who: Who[] | Who
  except: ExceptItem[]
  when: When
}

type SummaryFallback = Omit<SummaryRule, "what">

// Present => the parameters and every rule clause become editable in place.
// Absent => everything renders as static text (saved-policy cards).
export type PolicyEdit = {
  allowed: AllowedOptions
  pending: boolean
  activeCategories: Category[]
  propertyUsers: PropertyUser[]
  onAddRule: () => void
  patchRule: (
    idx: number,
    patch: Partial<{ what: What; how: How; when: When }>,
  ) => void
  removeRule: (idx: number) => void
  moveRule: (idx: number, delta: -1 | 1) => void
  addWhoToRule: (idx: number, encoded: string) => void
  removeWhoFromRule: (idx: number, encoded: string) => void
  addExceptToRule: (idx: number, encoded: string) => void
  removeExceptFromRule: (idx: number, encoded: string) => void
  patchFallback: (patch: Partial<{ how: How; when: When }>) => void
  patchOccupancy: (patch: Partial<SplitPolicyOccupancy>) => void
  addWhoToFallback: (encoded: string) => void
  removeWhoFromFallback: (encoded: string) => void
  addExceptToFallback: (encoded: string) => void
  removeExceptFromFallback: (encoded: string) => void
}

type Props = {
  parameters: SplitPolicyParameter[] | undefined
  rules: SummaryRule[]
  fallback: SummaryFallback
  occupancy: SplitPolicyOccupancy
  groups: GroupWithMembers[]
  categories: Category[]
  eligibleOwners: EligibleOwner[]
  propertyName: string
  edit?: PolicyEdit
}

export function PolicySummary({
  parameters,
  rules,
  fallback,
  occupancy,
  groups,
  categories,
  eligibleOwners,
  propertyName,
  edit,
}: Props) {
  const { t } = useTranslation("settlement")
  const activeCategories = edit?.activeCategories ?? categories
  const propertyUsers = edit?.propertyUsers ?? []

  const fallbackSubject =
    rules.length > 0 ? t("All other expenses") : t("Expenses")

  // A "total" rule ("all categories (totals)") matches every expense, so the
  // fallback ("all other expenses") is unreachable — the split calc only falls
  // back when no rule matches. Hide it so the sentence reflects real behavior.
  const hasTotalRule = rules.some(r => r.what.kind === "total")

  // A short illustrative example of a SAMPLE_AMOUNT bill under this clause, shown
  // only in the live builder. "equally" is exact (sample / participant count);
  // person-days and ownership use made-up shares since the real split needs stay
  // and ownership data only known at settlement time. Returns undefined when
  // there is nothing meaningful to show.
  const buildExample = (clause: {
    how: { kind: How["kind"] }
    who: Who[] | Who
    except: ExceptItem[]
  }): string | undefined => {
    if (edit == null) return undefined
    if (clause.how.kind === "equally") {
      const who = normalizeWho(clause.who)
      if (who.length === 0) return undefined
      let n = 0
      for (const w of who) {
        if (w.kind === "all_users") n += propertyUsers.length
        else if (w.kind === "main_groups" || w.kind === "heads_only")
          n += eligibleOwners.length
        else n += 1
      }
      n -= clause.except.filter(
        e => e.kind === "user" || e.kind === "group",
      ).length
      if (n < 1) return undefined
      return t("{{amount}} kr → {{each}} kr each", {
        amount: SAMPLE_AMOUNT,
        each: Math.round(SAMPLE_AMOUNT / n),
      })
    }
    // Made-up 3-party splits. Person-days spells out the setup (1 + 2 + 3 = 6
    // person-days) so the proportional result is easy to follow; ownership uses
    // round percentages. Day counts are literal in the string (natural
    // singular/plural); only the resulting amounts are interpolated.
    if (clause.how.kind === "weighted_by_occupancy") {
      const days = [1, 2, 3]
      const total = days[0] + days[1] + days[2]
      const amt = days.map(d => Math.round((SAMPLE_AMOUNT * d) / total))
      return t(
        "{{amount}} kr → person 1 (1 day): {{a1}} kr, person 2 (2 days): {{a2}} kr, person 3 (3 days): {{a3}} kr",
        {
          amount: SAMPLE_AMOUNT,
          a1: amt[0],
          a2: amt[1],
          a3: amt[2],
        },
      )
    }
    const pct = [50, 30, 20]
    const amt = pct.map(p => Math.round((SAMPLE_AMOUNT * p) / 100))
    return t(
      "{{amount}} kr → {{a1}} kr for {{p1}}%, {{a2}} kr for {{p2}}%, {{a3}} kr for {{p3}}%",
      {
        amount: SAMPLE_AMOUNT,
        a1: amt[0],
        p1: pct[0],
        a2: amt[1],
        p2: pct[1],
        a3: amt[2],
        p3: pct[2],
      },
    )
  }

  // Section 2 is only relevant when some rule actually splits by person-days.
  // In the live editable builder it lives in its own panel (OccupancyPanel) above
  // the builder, so here we only render the inline read-only summary used on
  // saved-policy cards (edit == null). A hidden (dead) fallback doesn't count.
  const usesOccupancy =
    (!hasTotalRule && fallback.how.kind === "weighted_by_occupancy") ||
    rules.some(r => r.how.kind === "weighted_by_occupancy")

  const ruleEdit = (idx: number): RuleEdit | undefined =>
    edit == null
      ? undefined
      : {
          allowed: edit.allowed,
          pending: edit.pending,
          onPatch: patch => {
            edit.patchRule(idx, patch)
          },
          onAddWho: enc => {
            edit.addWhoToRule(idx, enc)
          },
          onRemoveWho: enc => {
            edit.removeWhoFromRule(idx, enc)
          },
          onAddExcept: enc => {
            edit.addExceptToRule(idx, enc)
          },
          onRemoveExcept: enc => {
            edit.removeExceptFromRule(idx, enc)
          },
          onMove: delta => {
            edit.moveRule(idx, delta)
          },
          onRemove: () => {
            edit.removeRule(idx)
          },
          canMoveUp: idx > 0,
          canMoveDown: idx < rules.length - 1,
        }

  const fallbackEdit: RuleEdit | undefined =
    edit == null
      ? undefined
      : {
          allowed: edit.allowed,
          pending: edit.pending,
          onPatch: patch => {
            edit.patchFallback(patch)
          },
          onAddWho: edit.addWhoToFallback,
          onRemoveWho: edit.removeWhoFromFallback,
          onAddExcept: edit.addExceptToFallback,
          onRemoveExcept: edit.removeExceptFromFallback,
        }

  return (
    <>
      {edit == null && (
        <Paragraph data-size="sm">
          {t("Based on: {{list}}", {
            list:
              normalizeParameters(parameters).length === 0
                ? t("nothing — everything splits equally")
                : normalizeParameters(parameters)
                    .map(p => t(PARAMETER_LABEL[p]))
                    .join(", "),
          })}
        </Paragraph>
      )}

      <div className={styles.rules}>
        {rules.map((rule, idx) => (
          <RuleSentence
            key={idx}
            rule={rule}
            subject=""
            groups={groups}
            activeCategories={activeCategories}
            categories={categories}
            propertyUsers={propertyUsers}
            eligibleOwners={eligibleOwners}
            propertyName={propertyName}
            example={buildExample(rule)}
            edit={ruleEdit(idx)}
          />
        ))}

        {edit != null && edit.allowed.categories && (
          <Button
            type="button"
            variant="secondary"
            data-size="sm"
            disabled={edit.pending}
            onClick={() => {
              edit.onAddRule()
            }}
          >
            {t("+ Add rule")}
          </Button>
        )}

        {!hasTotalRule && (
          <RuleSentence
            rule={fallback}
            subject={fallbackSubject}
            groups={groups}
            activeCategories={activeCategories}
            categories={categories}
            propertyUsers={propertyUsers}
            eligibleOwners={eligibleOwners}
            propertyName={propertyName}
            example={buildExample(fallback)}
            edit={fallbackEdit}
          />
        )}
      </div>

      {usesOccupancy && edit == null && (
        <OccupancyCounting occupancy={occupancy} eligibleOwners={eligibleOwners} />
      )}
    </>
  )
}
