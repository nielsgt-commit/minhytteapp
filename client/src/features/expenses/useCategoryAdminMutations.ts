import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useInvalidateExpenses } from "./useInvalidateExpenses.ts"
import { useTRPC } from "@/trpc/trpc.ts"

export function useCategoryAdminMutations() {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const invalidateExpenses = useInvalidateExpenses()

  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  const invalidateCategories = () =>
    qc.invalidateQueries({ queryKey: trpc.expenseCategory.list.queryKey() })

  const create = useMutation(
    trpc.expenseCategory.create.mutationOptions({
      onSuccess: () => {
        setNewName("")
        void invalidateCategories()
      },
    }),
  )

  const rename = useMutation(
    trpc.expenseCategory.rename.mutationOptions({
      onSuccess: () => {
        setEditingId(null)
        setEditingName("")
        void invalidateCategories()
        void invalidateExpenses()
      },
    }),
  )

  const archive = useMutation(
    trpc.expenseCategory.archive.mutationOptions({
      onSuccess: () => { void invalidateCategories() },
    }),
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
