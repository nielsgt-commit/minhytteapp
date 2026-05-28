import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Button, Card, Heading } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { UserCreationForm } from "./UserCreationForm"
import {
  PROPERTY_BASICS_FORM_ID,
  PropertyBasicsStep,
} from "./PropertyBasicsStep"
import { BuildingsStep } from "./BuildingsStep"
import { BedroomsStep } from "./BedroomsStep"
import { InfrastructureStep } from "./InfrastructureStep"
import { EquipmentStep } from "./EquipmentStep"
import { WizardFooter } from "./WizardFooter"
import styles from "./OnboardingFlow.module.css"

type Step =
  | "user"
  | "basics"
  | "buildings"
  | "rooms"
  | "infrastructure"
  | "equipment"
  | "done"

const STEPS: readonly Step[] = [
  "user",
  "basics",
  "buildings",
  "rooms",
  "infrastructure",
  "equipment",
  "done",
] as const

const NEXT: Record<Step, Step> = {
  user: "basics",
  basics: "buildings",
  buildings: "rooms",
  rooms: "infrastructure",
  infrastructure: "equipment",
  equipment: "done",
  done: "done",
}

const PREV: Partial<Record<Step, Step>> = {
  buildings: "basics",
  rooms: "buildings",
  infrastructure: "rooms",
  equipment: "infrastructure",
}

type Props = {
  /** In preview mode the wizard ignores persisted onboarding_step and skips
   *  writes to it — so devs can iterate on the UI without corrupting their
   *  own user row. */
  preview?: boolean
}

export function OnboardingFlow({ preview = false }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const navigate = useNavigate()

  const { data: properties } = useSuspenseQuery(
    trpc.property.mine.queryOptions(),
  )
  const { data: me } = useQuery(trpc.user.me.queryOptions())

  const meKey = trpc.user.me.queryKey()
  const setStep = useMutationWithInvalidation(
    trpc.user.setOnboardingStep.mutationOptions(),
    [meKey],
  )
  const dismiss = useMutationWithInvalidation(
    trpc.user.dismissOnboarding.mutationOptions(),
    [meKey],
  )

  const onboardingKeys = [trpc.user.me.queryKey(), trpc.property.mine.queryKey()]
  const createUser = useMutationWithInvalidation(
    trpc.user.create.mutationOptions(),
    onboardingKeys,
  )
  const createProperty = useMutationWithInvalidation(
    trpc.property.create.mutationOptions(),
    onboardingKeys,
  )

  const firstProperty = properties.at(0) ?? null

  const dataDerivedStep: Step = (() => {
    if (!me) return "user"
    if (!firstProperty) return "basics"
    return "buildings"
  })()

  // In preview mode we keep step in local state so the dev can step through
  // freely without persisting. Otherwise we read from the user row.
  const [previewStep, setPreviewStep] = useState<Step>(dataDerivedStep)
  const currentStep: Step = preview
    ? previewStep
    : (me?.onboarding_step ?? dataDerivedStep)

  const persistStep = async (step: Step) => {
    if (preview) {
      setPreviewStep(step)
      return
    }
    await setStep.mutateAsync({ step })
  }

  const advance = (from: Step) => persistStep(NEXT[from])

  const finishLater = async () => {
    if (!preview) await setStep.mutateAsync({ step: currentStep })
    await navigate({ to: "/dashboard" })
  }

  const dismissForever = async () => {
    if (!preview) await dismiss.mutateAsync()
    await navigate({ to: "/dashboard" })
  }

  const goToDashboard = async () => {
    if (!preview) await setStep.mutateAsync({ step: "done" })
    await navigate({ to: "/dashboard" })
  }

  const lastError =
    createUser.error ??
    createProperty.error ??
    setStep.error ??
    dismiss.error

  const footerPending = setStep.isPending || dismiss.isPending

  return (
    <div className={styles.root}>
      <header className={styles.intro}>
        <Heading level={2}>{t("Welcome")}</Heading>
        <p>
          {t(
            "A few quick questions so we know what's on the property. Skip anything you don't have the answer to.",
          )}
        </p>
      </header>

      <Card className={styles.outerCard}>
        <Card.Block className={styles.body}>
          <div className={styles.content}>
            {preview && (
        <div
          role="navigation"
          aria-label="dev step picker"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: "0.5rem",
            margin: "0.5rem 0",
            border: "1px dashed var(--ds-color-warning-border-default)",
            borderRadius: "4px",
            background: "var(--ds-color-warning-surface-default)",
          }}
        >
          <strong style={{ marginRight: "0.5rem" }}>🛠 preview:</strong>
          {STEPS.map(s => (
            <Button
              key={s}
              type="button"
              variant={s === currentStep ? "primary" : "tertiary"}
              data-size="sm"
              onClick={() => {
                setPreviewStep(s)
              }}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      {currentStep === "user" && (
        <UserCreationForm
          onSubmit={async input => {
            if (!preview) {
              await createUser.mutateAsync({ ...input, is_admin: true })
            }
            await persistStep("basics")
          }}
        />
      )}

      {currentStep === "basics" && (
        <PropertyBasicsStep
          initial={
            firstProperty
              ? {
                  address: firstProperty.address,
                  name: firstProperty.name,
                  parking_spots: firstProperty.parking_spots,
                }
              : undefined
          }
          onSubmit={async input => {
            if (!preview && !firstProperty) {
              await createProperty.mutateAsync(input)
            }
            await persistStep("buildings")
          }}
        />
      )}

      {currentStep === "buildings" && firstProperty && (
        <BuildingsStep propertyId={firstProperty.id} />
      )}

      {currentStep === "rooms" && firstProperty && (
        <BedroomsStep propertyId={firstProperty.id} />
      )}

      {currentStep === "infrastructure" && firstProperty && (
        <InfrastructureStep propertyId={firstProperty.id} />
      )}

      {currentStep === "equipment" && firstProperty && (
        <EquipmentStep propertyId={firstProperty.id} />
      )}

      {currentStep === "done" && (
        <div>
          <p>
            {t(
              "All set. To add more details later, open the property dropdown in the top header and pick \"Manage property\".",
            )}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginTop: "1rem",
            }}
          >
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              disabled={footerPending}
              onClick={() => {
                void persistStep("equipment")
              }}
            >
              {t("Back")}
            </Button>
            <Button
              type="button"
              disabled={footerPending}
              onClick={() => {
                void goToDashboard()
              }}
            >
              {t("Go to dashboard")}
            </Button>
          </div>
        </div>
      )}
          </div>

      {currentStep !== "done" && currentStep !== "user" && (
        <div className={styles.footer}>
        <WizardFooter
          primary={
            currentStep === "basics"
              ? {
                  label: t("Continue"),
                  type: "submit",
                  form: PROPERTY_BASICS_FORM_ID,
                }
              : {
                  label: t("Continue"),
                  onClick: () => {
                    void advance(currentStep)
                  },
                }
          }
          onBack={
            PREV[currentStep]
              ? () => {
                  const prev = PREV[currentStep]
                  if (prev) void persistStep(prev)
                }
              : undefined
          }
          onSkip={
            currentStep === "basics"
              ? undefined
              : () => {
                  void advance(currentStep)
                }
          }
          onFinishLater={() => {
            void finishLater()
          }}
          onDismiss={() => {
            void dismissForever()
          }}
          pending={footerPending}
        />
        </div>
      )}
        </Card.Block>
      </Card>
    </div>
  )
}
