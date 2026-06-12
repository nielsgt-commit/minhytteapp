import { Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { Temporal } from "temporal-polyfill"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { fdString } from "@/utils/formData"
import { toDateInputValue } from "@/utils/dateUtils"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import styles from "./ProfileSection.module.css"

type Me = {
  id: number
  name: string
  birthday: Temporal.PlainDate | null
  my_main_memberships: {
    property_id: number
    property_name: string
    user_group_id: number
    is_head: boolean
  }[]
}

type ProfileSectionProps = {
  me: Me
}

export function ProfileSection({ me }: ProfileSectionProps) {
  const { t } = useTranslation("usersettings")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()

  const meKeys = [trpc.user.me.queryKey()]

  const updateName = useMutationWithInvalidation(
    trpc.user.updateMyName.mutationOptions(),
    meKeys,
  )

  const updateBirthday = useMutationWithInvalidation(
    trpc.user.updateMyBirthday.mutationOptions(),
    meKeys,
  )

  const updateHead = useMutationWithInvalidation(
    trpc.user.updateMyHeadForProperty.mutationOptions(),
    meKeys,
  )

  // The household-head flag is per-cabin, so scope this control to the cabin
  // currently selected in the header rather than listing every membership.
  const selectedMembership = me.my_main_memberships.find(
    m => m.property_id === selectedPropertyId,
  )

  return (
    <>
      <form
        action={async fd => {
          const trimmed = fdString(fd, "name").trim()
          if (!trimmed || trimmed === me.name) return
          try {
            await updateName.mutateAsync({ name: trimmed })
          } catch {
            /* surfaced via updateName.error */
          }
        }}
      >
        <Fieldset>
          <Fieldset.Legend>{t("Display name")}</Fieldset.Legend>
          <div className={styles.row}>
            <Textfield
              className={styles.field}
              label={t("Name")}
              type="text"
              name="name"
              defaultValue={me.name}
              required
              key={`name-${String(me.id)}-${me.name}`}
            />
            <SubmitButton>{t("Save")}</SubmitButton>
          </div>
          <ErrorAlert error={updateName.error} />
        </Fieldset>
      </form>

      <form
        action={async fd => {
          const raw = fdString(fd, "birthday").trim()
          const next = raw === "" ? null : Temporal.PlainDate.from(raw)
          const unchanged =
            next == null
              ? me.birthday == null
              : me.birthday != null && next.equals(me.birthday)
          if (unchanged) return
          try {
            await updateBirthday.mutateAsync({ birthday: next })
          } catch {
            /* surfaced via updateBirthday.error */
          }
        }}
      >
        <Fieldset>
          <Fieldset.Legend>{t("Birthday")}</Fieldset.Legend>
          <div className={styles.row}>
            <Textfield
              className={styles.field}
              label={t("Birthday")}
              type="date"
              name="birthday"
              defaultValue={toDateInputValue(me.birthday)}
              key={`birthday-${String(me.id)}-${toDateInputValue(me.birthday)}`}
            />
            <SubmitButton>{t("Save")}</SubmitButton>
          </div>
          <ErrorAlert error={updateBirthday.error} />
        </Fieldset>
      </form>

      <Fieldset>
        <Fieldset.Legend>{t("Household role")}</Fieldset.Legend>
        {selectedMembership ? (
          <Checkbox
            key={selectedMembership.property_id}
            name={`is_head-${String(selectedMembership.property_id)}`}
            label={t(
              "I am a household head for {{property}} (can be assigned a priority week and settlement)",
              { property: selectedMembership.property_name },
            )}
            checked={selectedMembership.is_head}
            disabled={updateHead.isPending}
            onChange={e => {
              updateHead.mutate({
                property_id: selectedMembership.property_id,
                is_head: e.target.checked,
              })
            }}
          />
        ) : (
          <p>{t("You are not in a family group for this cabin yet.")}</p>
        )}
        <ErrorAlert error={updateHead.error} />
      </Fieldset>
    </>
  )
}
