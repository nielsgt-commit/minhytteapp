import { Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "./ErrorAlert"
import styles from "./ProfileSection.module.css"

type Me = {
  id: number
  name: string
  birthday: string | null
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
          const next = raw === "" ? null : raw
          if (next === (me.birthday ?? null)) return
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
              defaultValue={me.birthday ?? ""}
              key={`birthday-${String(me.id)}-${me.birthday ?? ""}`}
            />
            <SubmitButton>{t("Save")}</SubmitButton>
          </div>
          <ErrorAlert error={updateBirthday.error} />
        </Fieldset>
      </form>

      <Fieldset>
        <Fieldset.Legend>{t("Household role")}</Fieldset.Legend>
        {me.my_main_memberships.length === 0 ? (
          <p>{t("You are not in a family group yet.")}</p>
        ) : (
          me.my_main_memberships.map(m => (
            <Checkbox
              key={m.property_id}
              name={`is_head-${String(m.property_id)}`}
              label={t(
                "I am a household head for {{property}} (can be assigned a priority week and settlement)",
                { property: m.property_name },
              )}
              checked={m.is_head}
              disabled={updateHead.isPending}
              onChange={e => {
                updateHead.mutate({
                  property_id: m.property_id,
                  is_head: e.target.checked,
                })
              }}
            />
          ))
        )}
        <ErrorAlert error={updateHead.error} />
      </Fieldset>
    </>
  )
}
