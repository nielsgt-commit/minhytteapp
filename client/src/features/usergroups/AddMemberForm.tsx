import { type SyntheticEvent } from "react"
import { Button, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdString } from "@/utils/formData"

const ADD_USER_SENTINEL = "__add__"
const INVITE_PREFIX = "invite:"

type AvailableUser = { id: number; name: string }
type AvailableInvite = { id: number; email: string }

type AddMemberFormProps = {
  groupName: string
  availableUsers: AvailableUser[]
  availableInvites: AvailableInvite[]
  pending: boolean
  onSubmit: (userId: number, reset: () => void) => void
  onAddInvite: (inviteId: number, reset: () => void) => void
  onSwitchToCreateUser: () => void
  onCancel: () => void
}

export function AddMemberForm({
  groupName,
  availableUsers,
  availableInvites,
  pending,
  onSubmit,
  onAddInvite,
  onSwitchToCreateUser,
  onCancel,
}: AddMemberFormProps) {
  const { t } = useTranslation("usergroups")
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const value = fdString(fd, "user_id")
    const reset = () => {
      form.reset()
    }
    if (value === "" || value === ADD_USER_SENTINEL) return
    if (value.startsWith(INVITE_PREFIX)) {
      const inviteId = Number(value.slice(INVITE_PREFIX.length))
      if (!Number.isFinite(inviteId)) return
      onAddInvite(inviteId, reset)
      return
    }
    const user_id = Number(value)
    if (!Number.isFinite(user_id)) return
    onSubmit(user_id, reset)
  }
  const hasOptions = availableUsers.length > 0 || availableInvites.length > 0

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
              {availableInvites.map(inv => (
                <Select.Option
                  key={`invite-${String(inv.id)}`}
                  value={`${INVITE_PREFIX}${String(inv.id)}`}
                >
                  {t("{{email}} (invited)", { email: inv.email })}
                </Select.Option>
              ))}
              <Select.Option value={ADD_USER_SENTINEL}>
                {t("+ Add user")}
              </Select.Option>
            </Select>
          </label>
        </div>
        <div>
          <Button type="submit" disabled={pending || !hasOptions}>
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
