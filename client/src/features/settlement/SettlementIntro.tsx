import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Heading, Paragraph, Tag } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { usePhaseLabels } from "@/features/settlement/SettlementPhaseStepper.tsx"
import { StepBadge } from "@/components/shared/StepBadge.tsx"
import {
  requiredPhases,
  type SettlementPhase,
} from "@server/shared/splitPolicy.ts"
import { normalizeParameters } from "@server/shared/splitPolicy.ts"
import { useTRPC } from "@/trpc/trpc"
import styles from "./SettlementIntro.module.css"

// Shown between the overview and the phase-by-phase flow: the prep work that
// already happened (starting the settlement, picking a split policy) followed
// by a plain walkthrough of what each step does, with a single action that
// drops the user into the settlement's current step.
export function SettlementIntro({
  propertyId,
  settlementId,
  onContinue,
}: {
  propertyId: number
  settlementId: number
  onContinue: () => void
}) {
  const { t } = useTranslation("settlement")
  const trpc = useTRPC()
  const phaseLabels = usePhaseLabels()

  const { data: settlements } = useSuspenseQuery(
    trpc.settlement.listForProperty.queryOptions({ property_id: propertyId }),
  )
  const { data: policies } = useSuspenseQuery(
    trpc.propertySplitPolicy.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const settlement = settlements.find(s => s.id === settlementId)
  if (settlement == null) return null

  const phase = settlement.phase

  // Same phase resolution as SettlementFlow so the intro lists exactly the
  // steps the stepper will show.
  const policy =
    settlement.split_policy_id == null
      ? undefined
      : policies.find(p => p.id === settlement.split_policy_id)
  const parameters = normalizeParameters(policy?.config.parameters)
  const phases = requiredPhases(parameters)
  const policyName = policy?.name ?? t("Occupancy days (built-in)")

  const prepSteps = [
    {
      key: "start",
      title: t("Start the settlement"),
      body:
        settlement.created_by_name != null
          ? t("Started by {{name}} for {{year}}.", {
              name: settlement.created_by_name,
              year: String(settlement.year),
            })
          : t("The settlement is open."),
    },
    {
      key: "policy",
      title: t("Pick a split policy"),
      body: t("Costs will be split using “{{name}}”.", { name: policyName }),
    },
  ]

  const descriptions: Record<SettlementPhase, string> = {
    collecting_expenses: t(
      "Go through the shared expenses logged for the period and make sure they all belong here and the amounts are right.",
    ),
    collecting_bookings: t(
      "Check how many nights each household stayed. The nights each household spent decide how much of the total they carry.",
    ),
    reviewing: t(
      "Each household head goes over the figures and ticks off when they're happy. Everyone has to be done before the settlement can move on.",
    ),
    split_policy: t(
      "See the total split between the households by how much each used the cabin, with the exact transfers needed to even things out. Each head accepts the result.",
    ),
    closed: t(
      "Once everyone has accepted, the settlement is closed and the agreed amounts are settled up between the households.",
    ),
  }

  const continueLabels: Record<SettlementPhase, string> = {
    collecting_expenses: t("Review expenses"),
    collecting_bookings: t("Review stays"),
    reviewing: t("Start reviewing"),
    split_policy: t("Review the split"),
    closed: t("View the result"),
  }

  return (
    <div className={styles.intro}>
      <div>
        <Heading level={2} data-size="sm">
          {t("How the settlement works")}
        </Heading>
        <Paragraph data-size="sm" className={styles.subtitle}>
          {t(
            "The settlement moves through these steps in order — here's what each one is about.",
          )}
        </Paragraph>
      </div>
      <ul className={styles.steps}>
        {prepSteps.map(step => (
          <li key={step.key} className={styles.step}>
            <StepBadge state="done" />
            <div>
              <div className={styles.stepTitle}>
                <span>{step.title}</span>
                <Tag data-size="sm" data-color="success">
                  {t("Done")}
                </Tag>
              </div>
              <Paragraph data-size="sm" className={styles.stepBody}>
                {step.body}
              </Paragraph>
            </div>
          </li>
        ))}
      </ul>
      <ol className={styles.steps}>
        {phases.map((p, i) => (
          <li key={p} className={styles.step}>
            <StepBadge
              number={i + 1}
              state={p === phase ? "active" : undefined}
            />
            <div>
              <div className={styles.stepTitle}>
                <span>{phaseLabels[p]}</span>
                {p === phase && (
                  <Tag data-size="sm" data-color="accent">
                    {t("Current step")}
                  </Tag>
                )}
              </div>
              <Paragraph data-size="sm" className={styles.stepBody}>
                {descriptions[p]}
              </Paragraph>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button type="button" onClick={onContinue}>
          {continueLabels[phase]}
        </Button>
      </div>
    </div>
  )
}
