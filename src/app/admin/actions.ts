'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, SESSION_HOURS, checkAdminPassword, createSessionToken, isAdminConfigured } from '@/lib/adminAuth'

export interface LoginState {
  error: string | null
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return { error: 'El panel no tiene contraseña configurada (ADMIN_PASSWORD).' }
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || !(await checkAdminPassword(password))) {
    // Pequeña pausa para frenar intentos repetidos
    await new Promise(r => setTimeout(r, 600))
    return { error: 'Contraseña incorrecta.' }
  }

  ;(await cookies()).set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: SESSION_HOURS * 3600,
  })
  redirect('/admin')
}

export async function logout() {
  ;(await cookies()).delete({ name: ADMIN_COOKIE, path: '/admin' })
  redirect('/admin/login')
}
