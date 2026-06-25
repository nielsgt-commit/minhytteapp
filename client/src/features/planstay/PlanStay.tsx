import { useState } from "react"
import {
  Button,
  Heading,
  Paragraph,
  ToggleGroup,
} from "@digdir/designsystemet-react"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { useTranslation } from "react-i18next"
import styles from "./PlanStay.module.css"
import { AddStayFlow } from "@/features/planstay/addstayflow/AddStayFlow.tsx"
import { StaySummaryCompact } from "@/features/planstay/staysummary/StaySummaryCompact.tsx"
import { PageHeader } from "@/components/shared/PageHeader"
import { QueryBoundary } from "@/components/shared/query-states/QueryBoundary"
import type { PageHelpContent } from "@/components/shared/PageHelp"

// The four steps of the plan flow, in order. The overview is no longer one of
// these — it's the dashboard you advance from — but once in the flow this
// stepper still lets you jump between the steps.
const STEP_VIEWS = ["dates", "guests", "rooms", "review"] as const
type StepView = (typeof STEP_VIEWS)[number]

const STEP_LABELS: Record<StepView, string> = {
  dates: "Dates",
  guests: "Guests",
  rooms: "Rooms",
  review: "Review",
}

export function PlanStay() {
  const { t } = useTranslation("planstay")
  const selectedPropertyId = useSelectedPropertyId()
  // The page lands on the season overview. From there you advance into the
  // step-by-step plan flow. `inFlow` is tracked separately from `currentStep`
  // so the flow (and its draft) stays mounted and remembers its step while the
  // overview shows.
  const [inFlow, setInFlow] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const help: PageHelpContent = {
    intro: t(
      "This is where you plan your own trips to the cabin. Pick the dates you want, say who's coming, and pick where everyone sleeps. You can also see who else has already booked the same period so you can avoid a crowd — or join in.",
    ),
    steps: [
      {
        title: t("Pick your dates"),
        body: t(
          "Choose the days you want to be at the cabin. You'll see how full the place is for those days, who else is already planning to be there, and whether any of the weeks are reserved as someone's priority week.",
        ),
      },
      {
        title: t("Say who's coming"),
        body: t(
          'Add the people joining you — other co-owners, family, and children. This is used to count beds and to show up in the "who\'s coming" lists the others see.',
        ),
      },
      {
        title: t("Choose where everyone sleeps"),
        body: t(
          "Assign your group to rooms and beds. The app warns you if a room is over capacity or already taken, so you can sort it out before you confirm.",
        ),
      },
      {
        title: t("Review and confirm"),
        body: t(
          "Check the summary, then confirm to save your stay. You can come back and edit or cancel it later if your plans change.",
        ),
      },
    ],
    connections: t(
      "Stays you plan here show up on the Dashboard calendar and in the lists of who's coming. The rooms and beds you can choose from come from the buildings set up under Manage Property → Structures. Priority weeks, when shown, are the reserved weeks managed under Manage Property.",
    ),
  }

  if (selectedPropertyId == null) {
    return (
      <section className={styles.page}>
        <PageHeader title={t("Plan stay")} help={help} />
        <p>
          {t(
            "Add or select a property to plan stays, block dates, and see who's booked in.",
          )}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <PageHeader title={t("Plan stay")} help={help} />

      {!inFlow && (
        <div className={styles.dashboard}>
          <header className={styles.header}>
            <div>
              <Heading level={2} data-size="sm">
                {t("Season overview")}
              </Heading>
              <Paragraph data-size="sm" className={styles.subtitle}>
                {t(
                  "See who's already planning to be at the cabin this season, then step through to plan your own stay.",
                )}
              </Paragraph>
            </div>
            <Button
              type="button"
              onClick={() => {
                setInFlow(true)
                setCurrentStep(1)
              }}
            >
              {t("Advance to plan stay →")}
            </Button>
          </header>
          <QueryBoundary>
            <StaySummaryCompact propertyId={selectedPropertyId} />
          </QueryBoundary>
        </div>
      )}

      {inFlow && (
        <>
          <div>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              onClick={() => {
                setInFlow(false)
              }}
            >
              {t("← Back to overview")}
            </Button>
          </div>
          <ToggleGroup
            value={STEP_VIEWS[currentStep - 1]}
            onChange={value => {
              setCurrentStep(STEP_VIEWS.indexOf(value as StepView) + 1)
            }}
            data-toggle-group={t("Booking steps")}
          >
            {STEP_VIEWS.map(view => (
              <ToggleGroup.Item key={view} value={view}>
                {t(STEP_LABELS[view])}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup>
        </>
      )}

      {/* Kept mounted (hidden on the overview) so the in-progress draft survives. */}
      <div className={inFlow ? styles.main : styles.hidden}>
        <QueryBoundary>
          <AddStayFlow
            propertyId={selectedPropertyId}
            currentStep={currentStep}
            onComplete={() => {
              // Stay saved: drop back to the overview and reset to step 1 so the
              // next plan starts fresh.
              setInFlow(false)
              setCurrentStep(1)
            }}
          />
        </QueryBoundary>
      </div>
    </section>
  )
}
