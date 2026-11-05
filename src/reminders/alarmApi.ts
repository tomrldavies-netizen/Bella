import { supabase } from '../lib/supabase'

export type RingingAlarm = {
  token: string
  type: 'feed' | 'medicine'
  title: string
  body: string
  url: string
  due_at: string
  ref_id: string
  snoozed: boolean
}

/** This person's alarms ringing now (feeds and medicines in alarm mode). */
export async function loadMyAlarms(): Promise<RingingAlarm[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('my_alarms')
  if (error) throw new Error(error.message)
  return (data ?? []) as RingingAlarm[]
}

export async function alarmAction(token: string, action: 'stop' | 'snooze') {
  if (!supabase) return
  const { error } = await supabase.rpc('alarm_action', { p_token: token, p_action: action })
  if (error) throw new Error(error.message)
}
