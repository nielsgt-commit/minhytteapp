import { useState } from "react"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button, Checkbox, Heading } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks.ts"
import { selectSelectedPropertyId } from "@/features/property/propertySlice.ts"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus"
import { CreateGroupForm } from "./CreateGroupForm.tsx"
import { GroupCard } from "./GroupCard.tsx"
import styles from "./UserGroupsFlow.module.css"

type OpenForm =
  | { kind: "create" }
  | { kind: "rename"; groupId: number }
  | { kind: "addMember"; groupId: number }
  | null

export function UserGroupsFlow() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  const propertyId = selectedPropertyId ?? 0

  const { data: groups } = useSuspenseQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const { data: users } = useSuspenseQuery(
    trpc.user.listForProperty.queryOptions({ property_id: propertyId }),
  )

  const invalidateGroups = () => {
    void qc.invalidateQueries({ queryKey: trpc.userGroup.pathKey() })
  }
  const invalidateUsers = () => {
    void qc.invalidateQueries({ queryKey: trpc.user.pathKey() })
  }

  const createGroup = useMutation(
    trpc.userGroup.create.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const updateGroup = useMutation(
    trpc.userGroup.update.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const deleteGroup = useMutation(
    trpc.userGroup.delete.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const addMember = useMutation(
    trpc.userGroup.addMember.mutationOptions({ onSuccess: invalidateGroups }),
  )
  const removeMember = useMutation(
    trpc.userGroup.removeMember.mutationOptions({
      onSuccess: invalidateGroups,
    }),
  )
  const createUser = useMutation(trpc.user.create.mutationOptions())

  const [openForm, setOpenForm] = useState<OpenForm>(null)
  const [addingUserForGroup, setAddingUserForGroup] = useState<number | null>(
    null,
  )
  const [editMode, setEditMode] = useState(false)

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
    createGroup.mutate(input, {
      onSuccess: () => {
        reset()
        setOpenForm(null)
      },
    })
  }

  const handleRename = (groupId: number) =>
    (input: { name: string; is_main: boolean }) => {
      updateGroup.mutate(
        { id: groupId, ...input },
        { onSuccess: () => { setOpenForm(null) } },
      )
    }

  const handleDelete = (groupId: number, groupName: string) => {
    if (!window.confirm(`Delete group "${groupName}"?`)) return
    deleteGroup.mutate(
      { id: groupId },
      { onSuccess: () => { setOpenForm(null) } },
    )
  }

  const handleAddMember = (groupId: number) =>
    (user_id: number, reset: () => void) => {
      addMember.mutate(
        { user_group_id: groupId, user_id },
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
            invalidateUsers()
            if (!created) return
            addMember.mutate(
              { user_group_id: groupId, user_id: created.id },
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
    if (!window.confirm(`Remove ${userName} from this group?`)) return
    removeMember.mutate({ user_group_id: groupId, user_id: userId })
  }

  return (
    <section>
      <Heading level={2}>User groups</Heading>
      <p>
        Groups bundle users so you can assign group ownership on a property and
        roll up settlements. Deleting a group is blocked while it is in use.
      </p>

      <Checkbox
        label="Edit mode"
        checked={editMode}
        onChange={e => {
          const next = e.currentTarget.checked
          setEditMode(next)
          if (!next) {
            setOpenForm(null)
            setAddingUserForGroup(null)
          }
        }}
      />

      {lastError && <p role="alert">Error: {lastError.message}</p>}

      {editMode && (
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
            {openForm?.kind === "create" ? "Cancel" : "New group"}
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
        <p>No groups yet.</p>
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
                editMode={editMode}
                isRenaming={isRenaming}
                isAddingMember={isAddingMember}
                isCreatingUser={addingUserForGroup === g.id}
                pending={pending}
                renamePending={updateGroup.isPending}
                addMemberPending={addMember.isPending}
                createUserPending={
                  createUser.isPending || addMember.isPending
                }
                onToggleRename={() => {
                  setOpenForm(v =>
                    v?.kind === "rename" && v.groupId === g.id
                      ? null
                      : { kind: "rename", groupId: g.id },
                  )
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
