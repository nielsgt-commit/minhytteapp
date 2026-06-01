import {
  Button,
  Card,
  Checkbox,
  Divider,
  Heading,
  List,
  Paragraph,
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
type AvailableInvite = { id: number; email: string }

type GroupCardProps = {
  group: Group
  availableUsers: AvailableUser[]
  availableInvites: AvailableInvite[]
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
  onAddInvite: (inviteId: number, reset: () => void) => void
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
  availableInvites,
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
  onAddInvite,
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
      <List.Item>
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
                  {group.is_family && (
                    <Paragraph data-size="sm"> {t("(main)")}</Paragraph>
                  )}
                </Heading>
                <Paragraph>
                  {t("{{count}} member", { count: group.members.length })}
                </Paragraph>
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

          <Divider />

          {group.members.length === 0 ? (
            <Paragraph>{t("No members yet.")}</Paragraph>
          ) : (
            <List.Unordered className={styles.memberList}>
              {group.members.map(m => (
                <List.Item key={m.user_id} className={styles.memberRow}>
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
                </List.Item>
              ))}
            </List.Unordered>
          )}

          {canEdit && !isRenaming && (
            <div className={styles.addMember}>
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
              availableInvites={availableInvites}
              pending={addMemberPending}
              onSubmit={onAddMember}
              onAddInvite={onAddInvite}
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
        </Card.Block>
      </List.Item>
    </Card>
  )
}
