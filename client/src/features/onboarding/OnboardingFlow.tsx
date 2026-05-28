import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Button, Heading } from "@digdir/designsystemet-react"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { UserCreationForm } from "./UserCreationForm"
import { PropertyBasicsStep } from "./PropertyBasicsStep"
import { BuildingsStep } from "./BuildingsStep"
import { BedroomsStep } from "./BedroomsStep"
import { InfrastructureStep } from "./InfrastructureStep"
import { EquipmentStep } from "./EquipmentStep"
import { WizardFooter } from "./WizardFooter"

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

  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
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

  const onboardingKeys = [
    trpc.user.list.queryKey(),
    trpc.property.mine.queryKey(),
  ]
  const createUser = useMutationWithInvalidation(
    trpc.user.create.mutationOptions(),
    onboardingKeys,
  )
  const createProperty = useMutationWithInvalidation(
    trpc.property.create.mutationOptions(),
    onboardingKeys,
  )

  const firstProperty = properties.at(0) ?? null
  const adminUser = users.find(u => u.is_admin) ?? users.at(0) ?? null

  const dataDerivedStep: Step = (() => {
    if (!adminUser) return "user"
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
    <section>
      <Heading level={2}>{t("Welcome")}</Heading>
      <p>
        {t(
          "A few quick questions so we know what's on the property. Skip anything you don't have the answer to.",
        )}
      </p>

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
        <BuildingsStep
          propertyId={firstProperty.id}
          onContinue={() => {
            void advance("buildings")
          }}
        />
      )}

      {currentStep === "rooms" && firstProperty && (
        <BedroomsStep
          propertyId={firstProperty.id}
          onContinue={() => {
            void advance("rooms")
          }}
        />
      )}

      {currentStep === "infrastructure" && firstProperty && (
        <InfrastructureStep
          propertyId={firstProperty.id}
          onContinue={() => {
            void advance("infrastructure")
          }}
        />
      )}

      {currentStep === "equipment" && firstProperty && (
        <EquipmentStep
          propertyId={firstProperty.id}
          onContinue={() => {
            void advance("equipment")
          }}
        />
      )}

      {currentStep === "done" && (
        <div>
          <p>{t("All set. You can manage everything from the dashboard.")}</p>
          <Button
            type="button"
            onClick={() => {
              void goToDashboard()
            }}
          >
            {t("Go to dashboard")}
          </Button>
        </div>
      )}

      {currentStep !== "done" && currentStep !== "user" && (
        <WizardFooter
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
      )}
    </section>
  )
}
