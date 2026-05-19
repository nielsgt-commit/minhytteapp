import { type SyntheticEvent } from "react"
import { Button, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdNumber } from "@/utils/formData"

const ADD_USER_SENTINEL = "__add__"

type AvailableUser = { id: number; name: string }

type AddMemberFormProps = {
  groupName: string
  availableUsers: AvailableUser[]
  pending: boolean
  onSubmit: (userId: number, reset: () => void) => void
  onSwitchToCreateUser: () => void
  onCancel: () => void
}

export function AddMemberForm({
  groupName,
  availableUsers,
  pending,
  onSubmit,
  onSwitchToCreateUser,
  onCancel,
}: AddMemberFormProps) {
  const { t } = useTranslation("usergroups")
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const user_id = fdNumber(fd, "user_id")
    if (!Number.isFinite(user_id)) return
    onSubmit(user_id, () => { form.reset() })
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>{t("Add member to {{groupName}}", { groupName })}</legend>
        <div>
          <label>
            {t("User")}
            <Select
              name="user_id"
              required
              defaultValue=""
              onChange={e => {
                if (e.currentTarget.value === ADD_USER_SENTINEL) {
                  onSwitchToCreateUser()
                }
              }}
            >
              <Select.Option value="" disabled>
                {t("Select user")}
              </Select.Option>
              {availableUsers.map(u => (
                <Select.Option key={u.id} value={u.id}>
                  {u.name}
                </Select.Option>
              ))}
              <Select.Option value={ADD_USER_SENTINEL}>
                {t("+ Add user")}
              </Select.Option>
            </Select>
          </label>
        </div>
        <div>
          <Button
            type="submit"
            disabled={pending || availableUsers.length === 0}
          >
            {t("Save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {t("Cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
