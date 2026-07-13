import { useSelectedPropertyId } from "@/selection/useSelection"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  Label,
  List,
  Paragraph,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationsStatus } from "@/hooks/useMutationsStatus.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation.ts"
import { useToggleState } from "@/hooks/useToggleState.ts"
import { SubmitButton } from "@/components/shared/SubmitButton"
import { ErrorAlert } from "@/components/shared/query-states/ErrorAlert"
import { fdString } from "@/utils/formData.ts"
import styles from "./AddUserRow.module.css"

// First item of the users list: lets a head/admin allowlist a new email
// directly, without visiting the separate invites page. Reuses
// allowedEmail.add, which also attaches already-existing users immediately.
export function AddUserRow() {
  const { t } = useTranslation("usergroups")
  const trpc = useTRPC()
  const selectedPropertyId = useSelectedPropertyId()
  const propertyId = selectedPropertyId ?? 0

  const groupsQuery = useQuery(
    trpc.userGroup.listWithMembersForProperty.queryOptions({
      property_id: propertyId,
    }),
  )
  const mainGroups = (groupsQuery.data ?? []).filter(g => g.is_family)

  const add = useMutationWithInvalidation(
    trpc.allowedEmail.add.mutationOptions(),
    // The existing-user branch of allowedEmail.add changes group membership
    // and property ownership right away, so users/groups must refetch too.
    [
      trpc.allowedEmail.list.queryKey(),
      trpc.user.pathKey(),
      trpc.userGroup.pathKey(),
    ],
  )

  const form = useToggleState()
  const { pending, error: lastError } = useMutationsStatus(add)

  const handleAdd = async (fd: FormData) => {
    const email = fdString(fd, "email").trim()
    const name = fdString(fd, "name").trim()
    const groupRaw = fdString(fd, "user_group_id")
    if (!email || !groupRaw) return
    try {
      await add.mutateAsync({
        email,
        name: name || null,
        property_id: propertyId,
        user_group_id: Number(groupRaw),
      })
      form.close()
    } catch {
      /* surfaced via useMutationsStatus */
    }
  }

  return (
    <Card asChild>
      <List.Item>
        <Card.Block>
          <ErrorAlert error={lastError} />

          {!form.value && (
            <Button type="button" disabled={pending} onClick={form.open}>
              {t("+ Add user")}
            </Button>
          )}

          {form.value &&
            groupsQuery.isSuccess &&
            (mainGroups.length === 0 ? (
              <>
                <Paragraph>{t("Create a group first.")}</Paragraph>
                <Button type="button" variant="secondary" onClick={form.close}>
                  {t("Cancel")}
                </Button>
              </>
            ) : (
              <form action={handleAdd}>
                <fieldset>
                  <legend>{t("New user")}</legend>
                  <div>
                    <Textfield
                      label={t("Name")}
                      type="text"
                      name="name"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Textfield
                      label={t("Email")}
                      type="email"
                      name="email"
                      required
                    />
                  </div>
                  <div>
                    <Label>
                      {t("Group")}
                      <Select
                        name="user_group_id"
                        defaultValue={mainGroups[0].id}
                        required
                      >
                        {mainGroups.map(g => (
                          <Select.Option key={g.id} value={g.id}>
                            {g.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Label>
                  </div>
                  <div className={styles.actionRow}>
                    <SubmitButton>{t("Add")}</SubmitButton>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={form.close}
                      disabled={add.isPending}
                    >
                      {t("Cancel")}
                    </Button>
                  </div>
                </fieldset>
              </form>
            ))}
        </Card.Block>
      </List.Item>
    </Card>
  )
}
