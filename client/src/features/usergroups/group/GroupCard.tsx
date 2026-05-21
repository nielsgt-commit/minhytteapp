import { type SyntheticEvent } from "react"
import { Button, Card, Checkbox, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdBoolean, fdString } from "@/utils/formData.ts"
import { AddMemberForm } from "../AddMemberForm.tsx"
import { CreateUserForm } from "../users/CreateUserForm.tsx"
import styles from "./GroupCard.module.css"

type Member = { user_id: number; user_name: string }

type Group = {
  id: number
  name: string
  is_main: boolean
  members: Member[]
}

type AvailableUser = { id: number; name: string }

type GroupCardProps = {
  group: Group
  availableUsers: AvailableUser[]
  editMode: boolean
  isRenaming: boolean
  isAddingMember: boolean
  isCreatingUser: boolean
  pending: boolean
  renamePending: boolean
  addMemberPending: boolean
  createUserPending: boolean
  onToggleRename: () => void
  onToggleAddMember: () => void
  onDelete: () => void
  onRenameSubmit: (input: { name: string; is_main: boolean }) => void
  onAddMember: (userId: number, reset: () => void) => void
  onCreateAndAddMember: (name: string, reset: () => void) => void
  onSwitchToCreateUser: () => void
  onBackFromCreateUser: () => void
  onCancelRename: () => void
  onCancelAddMember: () => void
  onRemoveMember: (userId: number, userName: string) => void
}

export function GroupCard({
  group,
  availableUsers,
  editMode,
  isRenaming,
  isAddingMember,
  isCreatingUser,
  pending,
  renamePending,
  addMemberPending,
  createUserPending,
  onToggleRename,
  onToggleAddMember,
  onDelete,
  onRenameSubmit,
  onAddMember,
  onCreateAndAddMember,
  onSwitchToCreateUser,
  onBackFromCreateUser,
  onCancelRename,
  onCancelAddMember,
  onRemoveMember,
}: GroupCardProps) {
  const { t } = useTranslation("usergroups")
  const handleRename = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fdString(fd, "name").trim()
    if (!name) return
    onRenameSubmit({ name, is_main: fdBoolean(fd, "is_main") })
  }

  return (
    <Card asChild>
      <li>
        <Card.Block>
          <h4>
            {group.name}
            {group.is_main && <small> {t("(main)")}</small>}
          </h4>
          <p>
            {t("{{count}} member", { count: group.members.length })}
          </p>

          {editMode && (
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onToggleRename}
              >
                {isRenaming ? t("Cancel") : t("Rename")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onToggleAddMember}
              >
                {isAddingMember ? t("Cancel") : t("Add member")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onDelete}
              >
                {t("Delete")}
              </Button>
            </div>
          )}

          {isRenaming && (
            <form onSubmit={handleRename} key={`rename-${String(group.id)}`}>
              <fieldset>
                <legend>{t("Edit group")}</legend>
                <div>
                  <Textfield
                    label={t("Name")}
                    type="text"
                    name="name"
                    defaultValue={group.name}
                    required
                  />
                </div>
                <div>
                  <Checkbox
                    label={t("Main")}
                    name="is_main"
                    defaultChecked={group.is_main}
                  />
                </div>
                <div>
                  <Button type="submit" disabled={renamePending}>
                    {t("Save")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancelRename}
                    disabled={renamePending}
                  >
                    {t("Cancel")}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}

          {isAddingMember && !isCreatingUser && (
            <AddMemberForm
              key={`add-member-${String(group.id)}`}
              groupName={group.name}
              availableUsers={availableUsers}
              pending={addMemberPending}
              onSubmit={onAddMember}
              onSwitchToCreateUser={onSwitchToCreateUser}
              onCancel={onCancelAddMember}
            />
          )}

          {isAddingMember && isCreatingUser && (
            <CreateUserForm
              key={`create-user-${String(group.id)}`}
              groupName={group.name}
              pending={createUserPending}
              onSubmit={onCreateAndAddMember}
              onBack={onBackFromCreateUser}
            />
          )}

          {group.members.length === 0 ? (
            <p>{t("No members yet.")}</p>
          ) : (
            <ul className={styles.memberList}>
              {group.members.map(m => (
                <li key={m.user_id} className={styles.memberRow}>
                  <span className={styles.memberName}>{m.user_name}</span>
                  {editMode && (
                    <Button
                      type="button"
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      onClick={() => { onRemoveMember(m.user_id, m.user_name) }}
                    >
                      {t("Remove")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card.Block>
      </li>
    </Card>
  )
}
