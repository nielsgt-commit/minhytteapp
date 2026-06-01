import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  List,
  Paragraph,
  ValidationMessage,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"
import { CreateGroupForm } from "./CreateGroupForm.tsx"
import { GroupCard } from "./group/GroupCard.tsx"
import styles from "./UserGroupsFlow.module.css"

type OpenForm =
  | { kind: "create" }
  | { kind: "rename"; groupId: number }
  | { kind: "addMember"; groupId: number }
  | null

type UserGroupsFlowProps = {
  canEdit: boolean
}

export function UserGroupsFlow({ canEdit }: UserGroupsFlowProps) {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )
  // Pending invites (people invited but not yet signed up) for this property,
  // shown in the member picker so a head can attach them to a group up-front.
  // allowedEmail.list is head/admin-only, so only fetch when the caller can edit.
  const { data: invitesData } = useQuery({
    ...trpc.allowedEmail.list.queryOptions({ property_id: propertyId }),
    enabled: canEdit,
  })
  const pendingInvites = (invitesData ?? []).filter(e => e.used_at == null)

  const groupKeys = [trpc.userGroup.pathKey()]

  const createGroup = useMutationWithInvalidation(
    trpc.userGroup.create.mutationOptions(),
    groupKeys,
  )
  const updateGroup = useMutationWithInvalidation(
    trpc.userGroup.update.mutationOptions(),
    groupKeys,
  )
  const deleteGroup = useMutationWithInvalidation(
    trpc.userGroup.delete.mutationOptions(),
    groupKeys,
  )
  const addMember = useMutationWithInvalidation(
    trpc.userGroup.addMember.mutationOptions(),
    groupKeys,
  )
  const removeMember = useMutationWithInvalidation(
    trpc.userGroup.removeMember.mutationOptions(),
    groupKeys,
  )
  const createUser = useMutationWithInvalidation(
    trpc.user.create.mutationOptions(),
    [trpc.user.pathKey()],
  )
  const assignInvite = useMutationWithInvalidation(
    trpc.allowedEmail.assignGroup.mutationOptions(),
    [trpc.userGroup.pathKey(), trpc.allowedEmail.pathKey()],
  )

  const [openForm, setOpenForm] = useState<OpenForm>(null)
  const [addingUserForGroup, setAddingUserForGroup] = useState<number | null>(
    null,
  )

  const { pending, error: lastError } = useMutationsStatus(
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    createUser,
    assignInvite,
  )

  const handleCreate = (
    input: { name: string; is_family: boolean },
    reset: () => void,
  ) => {
    createGroup.mutate(
      { ...input, property_id: propertyId },
      {
        onSuccess: () => {
          reset()
          setOpenForm(null)
        },
      },
    )
  }

  const handleRename =
    (groupId: number) =>
    async (input: { name: string; is_family: boolean }) => {
      await updateGroup.mutateAsync({
        id: groupId,
        ...input,
        property_id: propertyId,
      })
      setOpenForm(null)
    }

  const handleDelete = (groupId: number, groupName: string) => {
    if (!window.confirm(t('Delete group "{{groupName}}"?', { groupName })))
      return
    deleteGroup.mutate(
      { id: groupId, property_id: propertyId },
      {
        onSuccess: () => {
          setOpenForm(null)
        },
      },
    )
  }

  const handleAddMember =
    (groupId: number) => (user_id: number, reset: () => void) => {
      addMember.mutate(
        { user_group_id: groupId, user_id, property_id: propertyId },
        {
          onSuccess: () => {
            reset()
            setOpenForm(null)
          },
        },
      )
    }

  const handleAddInvite =
    (groupId: number) => (inviteId: number, reset: () => void) => {
      assignInvite.mutate(
        { id: inviteId, user_group_id: groupId, property_id: propertyId },
        {
          onSuccess: () => {
            reset()
            setOpenForm(null)
          },
        },
      )
    }

  const handleCreateAndAddMember =
    (groupId: number) => (name: string, reset: () => void) => {
      const email = `pending-${String(Date.now())}@example.local`
      createUser.mutate(
        { name, email },
        {
          onSuccess: created => {
            addMember.mutate(
              {
                user_group_id: groupId,
                user_id: created.id,
                property_id: propertyId,
              },
              {
                onSuccess: () => {
                  reset()
                  setAddingUserForGroup(null)
                  setOpenForm(null)
                },
              },
            )
          },
        },
      )
    }

  const handleRemoveMember = (
    groupId: number,
    userId: number,
    userName: string,
  ) => {
    if (
      !window.confirm(t("Remove {{userName}} from this group?", { userName }))
    )
      return
    removeMember.mutate({
      user_group_id: groupId,
      user_id: userId,
      property_id: propertyId,
    })
  }

  return (
    <section>
      {lastError && (
        <ValidationMessage role="alert">
          {t("Error: {{message}}", { message: lastError.message })}
        </ValidationMessage>
      )}

      <List.Unordered className={styles.groupList}>
        {canEdit && (
          <Card asChild>
            <List.Item>
              <Card.Block>
                {openForm?.kind === "create" ? (
                  <CreateGroupForm
                    pending={createGroup.isPending}
                    onSubmit={handleCreate}
                    onCancel={() => {
                      setOpenForm(null)
                    }}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="tertiary"
                    className={styles.addGroup}
                    disabled={pending}
                    onClick={() => {
                      setOpenForm({ kind: "create" })
                    }}
                  >
                    {t("+ Add group")}
                  </Button>
                )}
              </Card.Block>
            </List.Item>
          </Card>
        )}

        {groups.length === 0 && !canEdit ? (
          <Paragraph>{t("No groups yet.")}</Paragraph>
        ) : (
          groups.map(g => {
            const memberIds = new Set(g.members.map(m => m.user_id))
            const availableUsers = users.filter(u => !memberIds.has(u.id))
            // Unclaimed invites not already pointed at this group.
            const availableInvites = pendingInvites
              .filter(e => e.user_group_id !== g.id)
              .map(e => ({ id: e.id, email: e.email }))
            const isRenaming =
              openForm?.kind === "rename" && openForm.groupId === g.id
            const isAddingMember =
              openForm?.kind === "addMember" && openForm.groupId === g.id
            return (
              <GroupCard
                key={g.id}
                group={g}
                availableUsers={availableUsers}
                availableInvites={availableInvites}
                canEdit={canEdit}
                isRenaming={isRenaming}
                isAddingMember={isAddingMember}
                isCreatingUser={addingUserForGroup === g.id}
                pending={pending}
                renamePending={updateGroup.isPending}
                addMemberPending={addMember.isPending}
                createUserPending={createUser.isPending || addMember.isPending}
                onStartRename={() => {
                  setOpenForm({ kind: "rename", groupId: g.id })
                }}
                onToggleAddMember={() => {
                  setOpenForm(v =>
                    v?.kind === "addMember" && v.groupId === g.id
                      ? null
                      : { kind: "addMember", groupId: g.id },
                  )
                }}
                onDelete={() => {
                  handleDelete(g.id, g.name)
                }}
                onRenameSubmit={handleRename(g.id)}
                onAddMember={handleAddMember(g.id)}
                onAddInvite={handleAddInvite(g.id)}
                onCreateAndAddMember={handleCreateAndAddMember(g.id)}
                onSwitchToCreateUser={() => {
                  setAddingUserForGroup(g.id)
                }}
                onBackFromCreateUser={() => {
                  setAddingUserForGroup(null)
                }}
                onCancelRename={() => {
                  setOpenForm(null)
                }}
                onCancelAddMember={() => {
                  setOpenForm(null)
                }}
                onRemoveMember={(userId, userName) => {
                  handleRemoveMember(g.id, userId, userName)
                }}
              />
            )
          })
        )}
      </List.Unordered>
    </section>
  )
}
