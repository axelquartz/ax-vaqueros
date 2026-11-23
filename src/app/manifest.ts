import type { MetadataRoute } from 'next'

/** Permite instalar el sitio como app (necesario para recibir push en iPhone) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vaquero's",
    short_name: "Vaquero's",
    description: 'Pide en línea en Vaquero\'s',
    start_url: '/',
    display: 'standalone',
    background_color: '#14100D',
    theme_color: '#14100D',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
