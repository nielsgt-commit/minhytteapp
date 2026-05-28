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

export function EquipmentStep({ propertyId, onContinue }: Props) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const [adding, setAdding] = useState(false)

  const { data: items } = useSuspenseQuery(
    trpc.equipment.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const createEquipment = useMutationWithInvalidation(
    trpc.equipment.create.mutationOptions(),
    [trpc.equipment.listForProperty.queryKey({ property_id: propertyId })],
  )

  return (
    <section>
      <Heading level={3}>{t("Big equipment")}</Heading>
      <p>
        {t(
          "Lawnmower, boat, snow blower, or any vehicle that needs regular inspections?",
        )}
      </p>

      {items.length > 0 && (
        <ul>
          {items.map(i => (
            <li key={i.id}>
              <strong>{i.name}</strong>
              {i.brand && <span> – {i.brand}</span>}
              {i.acquired_year != null && <span> ({i.acquired_year})</span>}
            </li>
          ))}
        </ul>
      )}

      {createEquipment.error && (
        <p role="alert">
          {t("Error: {{message}}", { message: createEquipment.error.message })}
        </p>
      )}

      {adding ? (
        <form
          action={async fd => {
            const name = fdString(fd, "name").trim()
            if (!name) return
            const brand = fdString(fd, "brand").trim()
            const category = fdString(fd, "category").trim()
            const yearRaw = fdNumber(fd, "acquired_year")
            const acquired_year = Number.isFinite(yearRaw) ? yearRaw : null
            try {
              await createEquipment.mutateAsync({
                name,
                property_id: propertyId,
                brand: brand || undefined,
                category: category || undefined,
                acquired_year,
              })
              setAdding(false)
            } catch {
              /* surfaced via createEquipment.error */
            }
          }}
        >
          <Fieldset>
            <Fieldset.Legend>{t("Add equipment")}</Fieldset.Legend>
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
                label={t("Brand (optional)")}
                name="brand"
                type="text"
              />
            </div>
            <div>
              <Textfield
                label={t("Category (optional)")}
                name="category"
                type="text"
              />
            </div>
            <div>
              <Textfield
                label={t("Acquired year (optional)")}
                name="acquired_year"
                type="number"
                min={1500}
                max={2100}
                step={1}
                inputMode="numeric"
              />
            </div>
            <div>
              <SubmitButton>{t("Add equipment")}</SubmitButton>
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
