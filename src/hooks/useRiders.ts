'use client'

import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getBrowserSupabase } from '@/lib/supabase/browser'

export interface Rider {
  userId: string
  name: string
}

/** Repartidores del equipo (solo los administradores pueden listarlos) */
export function useRiders(): Rider[] {
  const [riders, setRiders] = useState<Rider[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    void getBrowserSupabase()
      .from('staff')
      .select('user_id, name')
      .eq('role', 'rider')
      .order('name')
      .then(({ data }) => setRiders((data ?? []).map(r => ({ userId: r.user_id as string, name: r.name as string }))))
  }, [])
  return riders
}
