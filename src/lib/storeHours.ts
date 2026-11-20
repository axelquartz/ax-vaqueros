import hoursData from '@/data/hours.json'

export interface DaySchedule {
  day:   number        // 0 = domingo
  label: string
  open:  string | null // "HH:MM" o null = cerrado ese día
  close: string | null
}

// ─── Helpers ──────────────────────────────────────────────
function getNowInTz(tz: string): { day: number; minutes: number } {
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday:  'short',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)

  return { day: dayMap[weekday] ?? 1, minutes: hour * 60 + minute }
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const schedule = hoursData.schedule as DaySchedule[]

// ─── Public API ───────────────────────────────────────────
export function isStoreOpen(): boolean {
  const { day, minutes } = getNowInTz(hoursData.timezone)
  const today = schedule.find(s => s.day === day)
  if (!today?.open || !today?.close) return false
  return minutes >= toMin(today.open) && minutes < toMin(today.close)
}

export function getTodaySchedule(): DaySchedule | null {
  const { day } = getNowInTz(hoursData.timezone)
  return schedule.find(s => s.day === day) ?? null
}

export function getStoreStatusText(): string {
  const { day, minutes } = getNowInTz(hoursData.timezone)
  const today = schedule.find(s => s.day === day)

  if (today?.open && today?.close) {
    const openMin  = toMin(today.open)
    const closeMin = toMin(today.close)
    if (minutes >= openMin && minutes < closeMin) {
      return `Abierto · Cierra a las ${today.close}`
    }
    // Hoy abre más tarde
    if (minutes < openMin) {
      return `Cerrado · Abre hoy a las ${today.open}`
    }
  }

  // Buscar siguiente día con horario
  for (let i = 1; i <= 7; i++) {
    const nextDay  = (day + i) % 7
    const next     = schedule.find(s => s.day === nextDay)
    if (next?.open) {
      const when = i === 1 ? 'mañana' : next.label
      return `Cerrado · Abre el ${when} a las ${next.open}`
    }
  }
  return 'Cerrado'
}

export function getAllSchedule(): DaySchedule[] {
  return schedule
}
