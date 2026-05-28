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

export function BuildingsStep({ propertyId, onContinue }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const [adding, setAdding] = useState(false)

  const { data: structures } = useSuspenseQuery(
    trpc.structure.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const createStructure = useMutationWithInvalidation(
    trpc.structure.create.mutationOptions(),
    [trpc.structure.listForProperty.queryKey({ property_id: propertyId })],
  )

  return (
    <section>
      <Heading level={3}>{t("Buildings on the property")}</Heading>
      <p>
        {t(
          "Add each building (cabin, anneks, boathouse, …). You can come back later.",
        )}
      </p>

      {structures.length > 0 && (
        <ul>
          {structures.map(s => (
            <li key={s.id}>
              {s.name}
              {s.built_year != null && <span> ({s.built_year})</span>}
            </li>
          ))}
        </ul>
      )}

      {createStructure.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: createStructure.error.message })}
        </p>
      )}

      {adding ? (
        <form
          action={async fd => {
            const name = fdString(fd, "name").trim()
            if (!name) return
            const yearRaw = fdNumber(fd, "built_year")
            const built_year = Number.isFinite(yearRaw) ? yearRaw : undefined
            try {
              await createStructure.mutateAsync({
                name,
                property_id: propertyId,
                built_year,
              })
              setAdding(false)
            } catch {
              /* surfaced via createStructure.error */
            }
          }}
        >
          <Fieldset>
            <Fieldset.Legend>{t("Add a building")}</Fieldset.Legend>
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
                label={t("Built year (optional)")}
                name="built_year"
                type="number"
                min={1500}
                max={2100}
                step={1}
                inputMode="numeric"
              />
            </div>
            <div>
              <SubmitButton>{t("Add building")}</SubmitButton>
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
          {structures.length === 0
            ? t("Add the first building")
            : t("Add another building")}
        </Button>
      )}

      <div>
        <Button type="button" onClick={onContinue}>
          {structures.length === 0 ? t("Skip for now") : t("Continue")}
        </Button>
      </div>
    </section>
  )
}
