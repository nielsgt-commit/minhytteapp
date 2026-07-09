import { Details, Paragraph } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./SplitCalculationDetails.module.css"

type BreakdownBucket = {
  rule_index: number | null
  category_names: string[] | null
  how: "equally" | "weighted_by_occupancy" | "by_ownership_pct"
  expense_count: number
  amount: number
  weights: { group_id: number; weight: number }[]
}

type Occupancy = {
  window: { kind: string }
  include_extra_guests: boolean
  child_weight: number
}

type Group = {
  group_id: number
  group_name: string
  total_paid: number
  total_share: number
  net: number
}

type Props = {
  totalReimbursed: number
  expenseCount: number
  groups: Group[]
  breakdown: {
    buckets: BreakdownBucket[]
    rounding: { group_id: number; amount: number } | null
    occupancy: Occupancy | null
  }
}

// Numbers are shown exactly as they enter the arithmetic: whole kroner as-is,
// fractions with two decimals so a calculator reproduces the same result.
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function bucketTotalWeight(b: BreakdownBucket): number {
  return b.weights.reduce((s, w) => s + w.weight, 0)
}

// A group's exact (unrounded) part of one bucket.
function bucketContribution(b: BreakdownBucket, groupId: number): number {
  const w = b.weights.find(x => x.group_id === groupId)
  const total = bucketTotalWeight(b)
  return w == null || total === 0 ? 0 : (b.amount * w.weight) / total
}

export function SplitCalculationDetails({
  totalReimbursed,
  expenseCount,
  groups,
  breakdown,
}: Props) {
  const { t } = useTranslation("settlement")
  const { buckets, rounding, occupancy } = breakdown
  const nameById = new Map(groups.map(g => [g.group_id, g.group_name]))
  const roundingGroupName =
    rounding != null ? (nameById.get(rounding.group_id) ?? "?") : null

  const bucketLabel = (b: BreakdownBucket) => {
    if (b.category_names != null && b.category_names.length > 0) {
      return t("Expenses in {{categories}} — {{amount}} kr:", {
        categories: b.category_names.join(", "),
        amount: fmt(b.amount),
      })
    }
    return buckets.length > 1
      ? t("All other expenses — {{amount}} kr:", { amount: fmt(b.amount) })
      : t("All the expenses together — {{amount}} kr:", {
          amount: fmt(b.amount),
        })
  }

  const howSentence = (how: BreakdownBucket["how"]) => {
    switch (how) {
      case "equally":
        return t("These are split evenly: every participant counts 1 point.")
      case "weighted_by_occupancy":
        return t(
          "These are split by use: every night one person stays at the cabin counts 1 point.",
        )
      case "by_ownership_pct":
        return t(
          "These are split by ownership: each household's points are its ownership percentage.",
        )
    }
  }

  const usesOccupancy = buckets.some(b => b.how === "weighted_by_occupancy")

  return (
    <Details data-size="sm">
      <Details.Summary>
        {t("How is this calculated? Check it step by step")}
      </Details.Summary>
      <Details.Content>
        <Paragraph data-size="sm">
          {t("Every number below comes from the figures on this page.")}
        </Paragraph>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <strong>{t("Add up the expenses")}</strong>
            <Paragraph data-size="sm">
              {t(
                "Number of approved expenses: {{count}}. Together they come to {{total}} kr — the “Total reimbursed” shown above.",
                {
                  count: String(expenseCount),
                  total: fmt(totalReimbursed),
                },
              )}
            </Paragraph>
          </li>

          <li className={styles.step}>
            <strong>{t("Split the total into each household's part")}</strong>
            {usesOccupancy && occupancy != null && (
              <>
                {occupancy.child_weight !== 1 && (
                  <Paragraph data-size="sm">
                    {occupancy.child_weight === 0
                      ? t("Children's nights are not counted.")
                      : t("A child's night counts {{weight}} points.", {
                          weight: fmt(occupancy.child_weight),
                        })}
                  </Paragraph>
                )}
                {occupancy.include_extra_guests && (
                  <Paragraph data-size="sm">
                    {t(
                      "Nights for extra guests written on a stay count for the household that booked it.",
                    )}
                  </Paragraph>
                )}
                {occupancy.window.kind !== "year" && (
                  <Paragraph data-size="sm">
                    {t(
                      "Only nights inside the period chosen in the policy are counted.",
                    )}
                  </Paragraph>
                )}
              </>
            )}
            {buckets.map((b, i) => {
              const totalWeight = bucketTotalWeight(b)
              return (
                <div key={i} className={styles.bucket}>
                  <Paragraph data-size="sm">
                    {bucketLabel(b)} {howSentence(b.how)}{" "}
                    {t(
                      "Each household's part is the amount × its own points ÷ all points together ({{total}}):",
                      { total: fmt(totalWeight) },
                    )}
                  </Paragraph>
                  <ul className={styles.math}>
                    {b.weights.map(w => (
                      <li key={w.group_id}>
                        {nameById.get(w.group_id) ?? "?"}: {fmt(b.amount)} ×{" "}
                        {fmt(w.weight)} ÷ {fmt(totalWeight)} ={" "}
                        {fmt(bucketContribution(b, w.group_id))} kr
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </li>

          <li className={styles.step}>
            <strong>{t("Round to whole kroner")}</strong>
            {buckets.length > 1 ? (
              <>
                <Paragraph data-size="sm">
                  {t(
                    "Each household's parts are added together and rounded to the nearest krone:",
                  )}
                </Paragraph>
                <ul className={styles.math}>
                  {groups.map(g => {
                    const parts = buckets.map(b =>
                      bucketContribution(b, g.group_id),
                    )
                    const exact = parts.reduce((s, p) => s + p, 0)
                    return (
                      <li key={g.group_id}>
                        {g.group_name}: {parts.map(fmt).join(" + ")} ={" "}
                        {fmt(exact)} ≈ {fmt(g.total_share)} kr
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <Paragraph data-size="sm">
                {t(
                  "Each household's part is rounded to the nearest whole krone.",
                )}
              </Paragraph>
            )}
            {rounding != null && (
              <Paragraph data-size="sm">
                {t(
                  "After rounding, the parts differ from the total by {{amount}} kr, so {{group}}'s part is adjusted by that amount. Then everything adds up to the total again.",
                  {
                    amount: fmt(rounding.amount),
                    group: roundingGroupName ?? "?",
                  },
                )}
              </Paragraph>
            )}
          </li>

          <li className={styles.step}>
            <strong>{t("Take paid minus part")}</strong>
            <ul className={styles.math}>
              {groups.map(g => (
                <li key={g.group_id}>
                  {t(
                    "{{name}}: paid {{paid}} kr − their part {{share}} kr = {{net}} kr",
                    {
                      name: g.group_name,
                      paid: fmt(g.total_paid),
                      share: fmt(g.total_share),
                      net: fmt(g.net),
                    },
                  )}
                </li>
              ))}
            </ul>
            <Paragraph data-size="sm">
              {t(
                "A plus means the household gets money back; a minus means it still owes.",
              )}
            </Paragraph>
          </li>

          <li className={styles.step}>
            <strong>{t("Even out the differences")}</strong>
            <Paragraph data-size="sm">
              {t(
                "The household that owes the most pays the household that is owed the most, one transfer at a time, until everyone lands on zero. Those payments are the transfers listed above.",
              )}
            </Paragraph>
          </li>
        </ol>
      </Details.Content>
    </Details>
  )
}
