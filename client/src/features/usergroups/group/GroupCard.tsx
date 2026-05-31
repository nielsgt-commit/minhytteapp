import {
  Button,
  Card,
  Checkbox,
  Heading,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { fdBoolean, fdString } from "@/utils/formData.ts"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { InlineEditRow } from "@/components/shared/InlineEditRow"
import { AddMemberForm } from "../AddMemberForm.tsx"
import { CreateUserForm } from "../users/CreateUserForm.tsx"
import styles from "./GroupCard.module.css"

type Member = { user_id: number; user_name: string }

type Group = {
  id: number
  name: string
  is_family: boolean
  members: Member[]
}

type AvailableUser = { id: number; name: string }

type GroupCardProps = {
  group: Group
  availableUsers: AvailableUser[]
  canEdit: boolean
  isRenaming: boolean
  isAddingMember: boolean
  isCreatingUser: boolean
  pending: boolean
  renamePending: boolean
  addMemberPending: boolean
  createUserPending: boolean
  onStartRename: () => void
  onToggleAddMember: () => void
  onDelete: () => void
  onRenameSubmit: (input: { name: string; is_family: boolean }) => Promise<void>
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
  canEdit,
  isRenaming,
  isAddingMember,
  isCreatingUser,
  pending,
  renamePending,
  addMemberPending,
  createUserPending,
  onStartRename,
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

  const renameForm = (
    <form
      key={`rename-${String(group.id)}`}
      action={async fd => {
        const name = fdString(fd, "name").trim()
        if (!name) return
        try {
          await onRenameSubmit({ name, is_family: fdBoolean(fd, "is_family") })
        } catch {
          /* surfaced by caller */
        }
      }}
    >
      <fieldset>
        <legend>{t("Edit group")}</legend>
        <div>
          <Textfield
            label={t("Name")}
            type="text"
            name="name"
            defaultValue={group.name}
            required
            autoFocus
          />
        </div>
        <div>
          <Checkbox
            label={t("Main")}
            name="is_family"
            defaultChecked={group.is_family}
          />
        </div>
        <div>
          <SubmitButton>{t("Save")}</SubmitButton>
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
  )

  return (
    <Card asChild>
      <li>
        <Card.Block>
          <InlineEditRow
            editing={isRenaming}
            canEdit={canEdit}
            pending={pending}
            editLabel={t("Edit group {{groupName}}", { groupName: group.name })}
            onStartEdit={onStartRename}
            view={
              <>
                <Heading level={4}>
                  {group.name}
                  {group.is_family && <small> {t("(main)")}</small>}
                </Heading>
                <p>{t("{{count}} member", { count: group.members.length })}</p>
              </>
            }
            form={renameForm}
            actions={
              <Button
                type="button"
                variant="tertiary"
                data-color="danger"
                data-size="sm"
                disabled={pending}
                aria-label={t("Delete group {{groupName}}", {
                  groupName: group.name,
                })}
                onClick={onDelete}
              >
                {t("Delete")}
              </Button>
            }
          />

          {canEdit && !isRenaming && (
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onToggleAddMember}
              >
                {isAddingMember ? t("Cancel") : t("Add member")}
              </Button>
            </div>
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
                  {canEdit && (
                    <Button
                      type="button"
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      disabled={pending}
                      aria-label={t("Remove {{userName}} from group", {
                        userName: m.user_name,
                      })}
                      onClick={() => {
                        onRemoveMember(m.user_id, m.user_name)
                      }}
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
