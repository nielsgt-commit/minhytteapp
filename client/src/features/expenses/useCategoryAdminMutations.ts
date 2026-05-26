import { useState } from "react"
import { useTRPC } from "@/trpc/trpc.ts"
import { useMutationWithInvalidation } from "@/hooks/useMutationWithInvalidation"

export function useCategoryAdminMutations() {
  const trpc = useTRPC()

  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  const categoryKey = [trpc.expenseCategory.list.queryKey()]
  const categoryAndExpenseKeys = [
    trpc.expenseCategory.list.queryKey(),
    trpc.expense.pathKey(),
  ]

  const create = useMutationWithInvalidation(
    trpc.expenseCategory.create.mutationOptions({
      onSuccess: () => { setNewName("") },
    }),
    categoryKey,
  )

  const rename = useMutationWithInvalidation(
    trpc.expenseCategory.rename.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
        setEditingName("")
      },
    }),
    categoryAndExpenseKeys,
  )

  const archive = useMutationWithInvalidation(
    trpc.expenseCategory.archive.mutationOptions(),
    categoryKey,
  )

  const startEdit = (id: number, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName("")
  }

  return {
    create,
    rename,
    archive,
    newName,
    setNewName,
    editingId,
    editingName,
    setEditingName,
    startEdit,
    cancelEdit,
  }
}
