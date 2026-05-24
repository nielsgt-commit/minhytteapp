import { type SyntheticEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Checkbox,
  Fieldset,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"
import { useTRPC } from "@/trpc/trpc"
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
  const qc = useQueryClient()

  const invalidateMe = () =>
    qc.invalidateQueries({ queryKey: trpc.user.me.queryKey() })

  const updateName = useMutation(
    trpc.user.updateMyName.mutationOptions({
      onSuccess: () => { void invalidateMe() },
    }),
  )

  const updateBirthday = useMutation(
    trpc.user.updateMyBirthday.mutationOptions({
      onSuccess: () => { void invalidateMe() },
    }),
  )

  const updateIsHead = useMutation(
    trpc.user.updateMyIsHead.mutationOptions({
      onSuccess: () => { void invalidateMe() },
    }),
  )

  const handleNameSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const trimmed = fdString(fd, "name").trim()
    if (!trimmed || trimmed === me.name) return
    updateName.mutate({ name: trimmed })
  }

  const handleBirthdaySubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const raw = fdString(fd, "birthday").trim()
    const next = raw === "" ? null : raw
    if (next === (me.birthday ?? null)) return
    updateBirthday.mutate({ birthday: next })
  }

  return (
    <>
      <form onSubmit={handleNameSubmit}>
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
          <Button type="submit" disabled={updateName.isPending}>
            {t("Save")}
          </Button>
          <ErrorAlert error={updateName.error} />
        </Fieldset>
      </form>

      <form onSubmit={handleBirthdaySubmit}>
        <Fieldset>
          <Fieldset.Legend>{t("Birthday")}</Fieldset.Legend>
          <Textfield
            label={t("Birthday")}
            type="date"
            name="birthday"
            defaultValue={me.birthday ?? ""}
            key={`birthday-${String(me.id)}-${me.birthday ?? ""}`}
          />
          <Button type="submit" disabled={updateBirthday.isPending}>
            {t("Save")}
          </Button>
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
