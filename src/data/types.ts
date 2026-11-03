export type Role = 'parent' | 'helper'

export type Member = {
  id: string
  household_id: string
  user_id: string | null
  display_name: string
  colour: string
  role: Role
  active: boolean
}

export type Household = {
  id: string
  name: string
}

export type Baby = {
  id: string
  household_id: string
  name: string
  /** YYYY-MM-DD */
  birth_date: string
  gestation_weeks: number
  gestation_days: number
  /** YYYY-MM-DD */
  due_date: string
}

export type NewHousehold = {
  displayName: string
  colour: string
  babyName: string
  birthDate: string
  gestationWeeks: number
  gestationDays: number
  dueDate: string
}
