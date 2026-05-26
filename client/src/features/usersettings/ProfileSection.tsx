import { Checkbox, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "./ErrorAlert"

type Me = {
  id: number
  name: string
  birthday: string | null
  is_head: boolean
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

  const updateIsHead = useMutationWithInvalidation(
    trpc.user.updateMyIsHead.mutationOptions(),
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
          <Textfield
            label={t("Name")}
            type="text"
            name="name"
            defaultValue={me.name}
            required
            key={`name-${String(me.id)}-${me.name}`}
          />
          <SubmitButton>{t("Save")}</SubmitButton>
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
          <Textfield
            label={t("Birthday")}
            type="date"
            name="birthday"
            defaultValue={me.birthday ?? ""}
            key={`birthday-${String(me.id)}-${me.birthday ?? ""}`}
          />
          <SubmitButton>{t("Save")}</SubmitButton>
          <ErrorAlert error={updateBirthday.error} />
        </Fieldset>
      </form>

      <Fieldset>
        <Fieldset.Legend>{t("Household role")}</Fieldset.Legend>
        <Checkbox
          name="is_head"
          label={t("I am a household head (can be assigned a priority week and settlement)")}
          checked={me.is_head}
          disabled={updateIsHead.isPending}
          onChange={e => {
            updateIsHead.mutate({ is_head: e.target.checked })
          }}
        />
        <ErrorAlert error={updateIsHead.error} />
      </Fieldset>
    </>
  )
}
