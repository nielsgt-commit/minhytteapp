export type RoomShape = {
  id: number
  name: string
  beds_sm: number
  beds_lg: number
  beds_double: number
  beds_kid: number
  mattresses: number
  travel_cot: number
  building_id: number
}

export type ExistingOccupant = {
  user_id: number
  user_name: string | null
  queued: boolean
}
