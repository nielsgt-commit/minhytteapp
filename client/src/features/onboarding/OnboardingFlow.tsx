import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Heading } from "@digdir/designsystemet-react"
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

const NEXT: Record<Step, Step> = {
  user: "basics",
  basics: "buildings",
  buildings: "rooms",
  rooms: "infrastructure",
  infrastructure: "equipment",
  equipment: "done",
  done: "done",
}

export function OnboardingFlow() {
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

  const currentStep: Step = (() => {
    const persisted = me?.onboarding_step
    if (persisted) return persisted
    if (!adminUser) return "user"
    if (!firstProperty) return "basics"
    return "buildings"
  })()

  const advance = async (from: Step) => {
    await setStep.mutateAsync({ step: NEXT[from] })
  }

  const finishLater = async () => {
    await setStep.mutateAsync({ step: currentStep })
    await navigate({ to: "/dashboard" })
  }

  const dismissForever = async () => {
    await dismiss.mutateAsync()
    await navigate({ to: "/dashboard" })
  }

  const goToDashboard = async () => {
    await setStep.mutateAsync({ step: "done" })
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

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      {currentStep === "user" && (
        <UserCreationForm
          onSubmit={async input => {
            await createUser.mutateAsync({ ...input, is_admin: true })
            await setStep.mutateAsync({ step: "basics" })
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
            if (!firstProperty) {
              await createProperty.mutateAsync(input)
            }
            await setStep.mutateAsync({ step: "buildings" })
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
          <button
            type="button"
            onClick={() => {
              void goToDashboard()
            }}
          >
            {t("Go to dashboard")}
          </button>
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
