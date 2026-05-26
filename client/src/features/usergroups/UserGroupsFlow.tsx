import { useSelectedPropertyId } from "@/features/property/propertySlice"
import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Button, Heading } from "@digdir/designsystemet-react"
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
  )

  const handleCreate = (
    input: { name: string; is_main: boolean },
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

  const handleRename = (groupId: number) =>
    async (input: { name: string; is_main: boolean }) => {
      await updateGroup.mutateAsync({
        id: groupId,
        ...input,
        property_id: propertyId,
      })
      setOpenForm(null)
    }

  const handleDelete = (groupId: number, groupName: string) => {
    if (!window.confirm(t("Delete group \"{{groupName}}\"?", { groupName }))) return
    deleteGroup.mutate(
      { id: groupId, property_id: propertyId },
      { onSuccess: () => { setOpenForm(null) } },
    )
  }

  const handleAddMember = (groupId: number) =>
    (user_id: number, reset: () => void) => {
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

  const handleCreateAndAddMember = (groupId: number) =>
    (name: string, reset: () => void) => {
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
    if (!window.confirm(t("Remove {{userName}} from this group?", { userName }))) return
    removeMember.mutate({
      user_group_id: groupId,
      user_id: userId,
      property_id: propertyId,
    })
  }

  return (
      <section>
      <Heading level={2}>{t("User groups")}</Heading>
      <p>
        {t("Groups bundle users so you can assign group ownership on a property and roll up settlements. Deleting a group is blocked while it is in use.")}
      </p>

      {lastError && <p role="alert">{t("Error: {{message}}", { message: lastError.message })}</p>}

      {canEdit && (
        <div>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpenForm(v =>
                v?.kind === "create" ? null : { kind: "create" },
              )
            }}
          >
            {openForm?.kind === "create" ? t("Cancel") : t("New group")}
          </Button>
        </div>
      )}

      {openForm?.kind === "create" && (
        <CreateGroupForm
          pending={createGroup.isPending}
          onSubmit={handleCreate}
          onCancel={() => { setOpenForm(null) }}
        />
      )}

      {groups.length === 0 ? (
        <p>{t("No groups yet.")}</p>
      ) : (
        <ul className={styles.groupList}>
          {groups.map(g => {
            const memberIds = new Set(g.members.map(m => m.user_id))
            const availableUsers = users.filter(u => !memberIds.has(u.id))
            const isRenaming =
              openForm?.kind === "rename" && openForm.groupId === g.id
            const isAddingMember =
              openForm?.kind === "addMember" && openForm.groupId === g.id
            return (
              <GroupCard
                key={g.id}
                group={g}
                availableUsers={availableUsers}
                canEdit={canEdit}
                isRenaming={isRenaming}
                isAddingMember={isAddingMember}
                isCreatingUser={addingUserForGroup === g.id}
                pending={pending}
                renamePending={updateGroup.isPending}
                addMemberPending={addMember.isPending}
                createUserPending={
                  createUser.isPending || addMember.isPending
                }
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
                onDelete={() => { handleDelete(g.id, g.name) }}
                onRenameSubmit={handleRename(g.id)}
                onAddMember={handleAddMember(g.id)}
                onCreateAndAddMember={handleCreateAndAddMember(g.id)}
                onSwitchToCreateUser={() => { setAddingUserForGroup(g.id) }}
                onBackFromCreateUser={() => { setAddingUserForGroup(null) }}
                onCancelRename={() => { setOpenForm(null) }}
                onCancelAddMember={() => { setOpenForm(null) }}
                onRemoveMember={(userId, userName) => {
                  handleRemoveMember(g.id, userId, userName)
                }}
              />
            )
          })}
        </ul>
      )}
      </section>
  )
}
