import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Fieldset,
  Heading,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { fdNumber, fdString } from "@/utils/formData"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"

type Props = {
  propertyId: number
  onContinue: () => void
}

export function InfrastructureStep({ propertyId, onContinue }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const [adding, setAdding] = useState(false)

  const { data: items } = useSuspenseQuery(
    trpc.infrastructure.listForProperty.queryOptions({
      property_id: propertyId,
    }),
  )

  const createInfra = useMutationWithInvalidation(
    trpc.infrastructure.create.mutationOptions(),
    [
      trpc.infrastructure.listForProperty.queryKey({
        property_id: propertyId,
      }),
    ],
  )

  return (
    <section>
      <Heading level={3}>{t("Infrastructure")}</Heading>
      <p>
        {t(
          "Does the property have a bridge, dock, well, septic, or anything similar?",
        )}
      </p>

      {items.length > 0 && (
        <ul>
          {items.map(i => (
            <li key={i.id}>
              <strong>{i.name}</strong> – {i.description}
              {i.since_year != null && <span> ({i.since_year})</span>}
            </li>
          ))}
        </ul>
      )}

      {createInfra.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: createInfra.error.message })}
        </p>
      )}

      {adding ? (
        <form
          action={async fd => {
            const name = fdString(fd, "name").trim()
            const description = fdString(fd, "description").trim()
            if (!name || !description) return
            const yearRaw = fdNumber(fd, "since_year")
            const since_year = Number.isFinite(yearRaw) ? yearRaw : undefined
            try {
              await createInfra.mutateAsync({
                name,
                description,
                property_id: propertyId,
                since_year,
              })
              setAdding(false)
            } catch {
              /* surfaced via createInfra.error */
            }
          }}
        >
          <Fieldset>
            <Fieldset.Legend>{t("Add infrastructure")}</Fieldset.Legend>
            <div>
              <Textfield
                label={t("Name")}
                name="name"
                type="text"
                required
                autoFocus
              />
            </div>
            <div>
              <Textfield
                label={t("Description")}
                name="description"
                type="text"
                required
              />
            </div>
            <div>
              <Textfield
                label={t("Since year (optional)")}
                name="since_year"
                type="number"
                min={1500}
                max={2100}
                step={1}
                inputMode="numeric"
              />
            </div>
            <div>
              <SubmitButton>{t("Add infrastructure")}</SubmitButton>
              <Button
                type="button"
                variant="tertiary"
                onClick={() => {
                  setAdding(false)
                }}
              >
                {t("Cancel")}
              </Button>
            </div>
          </Fieldset>
        </form>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAdding(true)
          }}
        >
          {items.length === 0 ? t("Yes, add one") : t("Add another")}
        </Button>
      )}

      <div>
        <Button type="button" onClick={onContinue}>
          {items.length === 0 ? t("No, skip ahead") : t("Continue")}
        </Button>
      </div>
    </section>
  )
}
