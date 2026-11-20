'use client'

import { useState, useEffect } from 'react'
import announcementsData from '@/data/announcements.json'

type BannerType = 'info' | 'warning' | 'promo'

const styles: Record<BannerType, string> = {
  info:    'bg-blue-500/10  border-blue-500/30  text-blue-300',
  warning: 'bg-warning/10  border-warning/30   text-warning',
  promo:   'bg-brand/10    border-brand/30     text-brand',
}

const DISMISS_KEY = 'ax_banner_dismissed'

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!announcementsData.active || !announcementsData.message) return
    // Re-muestra si el mensaje cambió desde la última vez que se cerró
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed !== announcementsData.message) setVisible(true)
  }, [])

  if (!visible) return null

  const type = (announcementsData.type as BannerType) ?? 'info'

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, announcementsData.message)
    setVisible(false)
  }

  return (
    <div className={`border-b px-4 py-2.5 flex items-center gap-3 animate-fade-in ${styles[type]}`}>
      <p className="flex-1 text-xs font-medium leading-snug">
        {announcementsData.message}
      </p>
      {announcementsData.dismissible && (
        <button
          onClick={dismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-sm leading-none"
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  )
}
