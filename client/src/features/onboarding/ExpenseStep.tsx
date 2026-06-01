import { useSuspenseQuery } from "@tanstack/react-query"
import { Chip, Divider, Heading, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc"
import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { fdString } from "@/utils/formData"
import { useCanEdit } from "@/hooks/useCanEdit"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import listStyles from "./StepList.module.css"

// Common shared-cost buckets offered as one-tap suggestions. Kept as
// translation keys so each locale can localise the seeded category names.
const SUGGESTED = [
  "Electricity",
  "Water",
  "Insurance",
  "Maintenance",
  "Municipal fees",
  "Internet",
] as const

export function ExpenseStep() {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0
  const canEdit = useCanEdit()

  const { data: categories } = useSuspenseQuery(
    trpc.expenseCategory.list.queryOptions({ property_id: propertyId }),
  )

  const keys = [trpc.expenseCategory.list.queryKey({ property_id: propertyId })]
  const createCategory = useMutationWithInvalidation(
    trpc.expenseCategory.create.mutationOptions(),
    keys,
  )
  const archiveCategory = useMutationWithInvalidation(
    trpc.expenseCategory.archive.mutationOptions(),
    keys,
  )

  const lastError = createCategory.error ?? archiveCategory.error
  const pending = createCategory.isPending || archiveCategory.isPending

  const existingNames = new Set(categories.map(c => c.name.toLowerCase()))

  const addCategory = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || existingNames.has(trimmed.toLowerCase())) return
    try {
      await createCategory.mutateAsync({
        property_id: propertyId,
        name: trimmed,
      })
    } catch {
      /* surfaced via lastError */
    }
  }

  const handleAdd = async (fd: FormData) => {
    await addCategory(fdString(fd, "name"))
  }

  const remainingSuggestions = SUGGESTED.filter(
    name => !existingNames.has(t(name).toLowerCase()),
  )

  return (
    <section>
      <Heading level={3}>{t("Expense categories")}</Heading>
      <p>
        {t(
          "Set up the buckets you'll sort shared costs into — electricity, water, maintenance, and the like. You can change these any time.",
        )}
      </p>

      {lastError && (
        <p role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </p>
      )}

      {categories.length > 0 && (
        <ul className={listStyles.list}>
          <li className={listStyles.actions}>
            {categories.map(c => (
              <Chip.Removable
                key={c.id}
                data-size="sm"
                disabled={!canEdit || pending}
                aria-label={t('Remove category "{{name}}"', { name: c.name })}
                onClick={() => {
                  archiveCategory.mutate({ property_id: propertyId, id: c.id })
                }}
              >
                {c.name}
              </Chip.Removable>
            ))}
          </li>
        </ul>
      )}

      {canEdit && remainingSuggestions.length > 0 && (
        <>
          <Divider />
          <p>{t("Quick add")}</p>
          <div className={listStyles.actions}>
            {remainingSuggestions.map(name => (
              <Chip.Button
                key={name}
                type="button"
                disabled={pending}
                onClick={() => {
                  void addCategory(t(name))
                }}
              >
                {t(name)}
              </Chip.Button>
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <form action={handleAdd} className={listStyles.addForm}>
          <Textfield
            label={t("Add a category")}
            name="name"
            type="text"
            disabled={createCategory.isPending}
          />
          <div className={listStyles.actions}>
            <SubmitButton>{t("Add")}</SubmitButton>
          </div>
        </form>
      )}
    </section>
  )
}
