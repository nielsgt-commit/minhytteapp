import { useAppSelector } from "./hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { selectSelectedUserId } from "@/features/user/userSlice"

export const useSelectedUserId = () => useAppSelector(selectSelectedUserId)
export const useSelectedPropertyId = () =>
  useAppSelector(selectSelectedPropertyId)
