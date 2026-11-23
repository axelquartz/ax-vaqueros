import Link from 'next/link'
import businessData from '@/data/business.json'
import { SiteHeader } from '@/components/layout/SiteHeader'

export const metadata = { title: "Aviso de privacidad — Vaquero's" }

const UPDATED = '23 de noviembre de 2026'

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Datos que recabamos',
    body: (
      <>
        <p>Al hacer un pedido te pedimos: nombre, teléfono y, solo si eliges entrega a domicilio, tu dirección y el punto que marcas en el mapa; si eliges mesa, el número de mesa. También guardamos las notas que escribas (por ejemplo alergias) y el contenido de tu pedido.</p>
        <p>Si dejas una reseña, guardamos la calificación y tu comentario. Durante una entrega a domicilio, el repartidor comparte su ubicación para que veas el avance de tu pedido.</p>
        <p>No recabamos datos personales sensibles, salvo que los escribas tú mismo en las notas.</p>
      </>
    ),
  },
  {
    title: 'Para qué los usamos',
    body: (
      <>
        <p><strong className="text-foreground">Necesarios para el servicio:</strong> preparar y entregar tu pedido, contactarte si hay algún problema, procesar tu pago, mostrarte el estatus de tu pedido y atender aclaraciones.</p>
        <p><strong className="text-foreground">Secundarios:</strong> estadísticas internas de ventas y mejorar el servicio, e invitarte a calificar tu pedido. Si no quieres que usemos tus datos para estos fines, escríbenos por los medios de la sección de derechos y lo dejamos de hacer.</p>
      </>
    ),
  },
  {
    title: 'Con quién los compartimos',
    body: (
      <>
        <p>No vendemos tus datos. Solo los compartimos con proveedores que hacen posible el servicio:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Mercado Pago</strong>, para cobrar. Los datos de tu tarjeta los captura directamente Mercado Pago; nosotros no los vemos ni los guardamos.</li>
          <li><strong className="text-foreground">Supabase</strong>, donde se almacenan los pedidos.</li>
          <li><strong className="text-foreground">Netlify</strong>, que aloja este sitio.</li>
          <li><strong className="text-foreground">Mapbox</strong> y <strong className="text-foreground">Google Maps</strong>, para ubicar y autocompletar tu dirección y mostrar mapas.</li>
        </ul>
        <p>Los repartidores de {businessData.name} ven tu nombre, teléfono y dirección únicamente de los pedidos que les asignamos. Fuera de lo anterior, solo compartimos datos cuando una autoridad competente lo exija.</p>
      </>
    ),
  },
  {
    title: 'Almacenamiento en tu dispositivo',
    body: (
      <p>Guardamos en tu navegador (almacenamiento local) el carrito y el acceso a tus pedidos recientes, para que puedas consultarlos. No usamos cookies de publicidad. Puedes borrarlos desde la configuración de tu navegador; si lo haces, dejarás de ver tu historial en este dispositivo.</p>
    ),
  },
  {
    title: 'Conservación',
    body: (
      <p>Conservamos los datos de tus pedidos mientras sean necesarios para atender aclaraciones y por las obligaciones fiscales y contables que apliquen. Después se eliminan o se anonimizan.</p>
    ),
  },
  {
    title: 'Tus derechos (ARCO)',
    body: (
      <>
        <p>Tienes derecho a Acceder a tus datos, Rectificarlos, Cancelarlos y Oponerte a su uso, así como a revocar tu consentimiento. Para ejercerlos, envía tu solicitud con tu nombre, el teléfono con el que pediste y lo que deseas hacer, a:</p>
        <p className="text-foreground">
          {'privacyEmail' in businessData && businessData.privacyEmail ? <>{String(businessData.privacyEmail)}<br /></> : null}
          Responsable: {businessData.legalName}<br />
          Teléfono / WhatsApp: {businessData.privacyPhone}<br />
          {businessData.address}
        </p>
        <p>Te responderemos en un máximo de 20 días hábiles.</p>
      </>
    ),
  },
  {
    title: 'Cambios a este aviso',
    body: (
      <p>Si este aviso cambia, publicaremos la versión actualizada en esta misma página, con su fecha.</p>
    ),
  },
]

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="max-w-2xl mx-auto w-full px-5 pb-16 mt-6 space-y-6">
        <div>
          <h1 className="font-display text-[1.625rem] font-bold leading-none text-foreground">Aviso de privacidad</h1>
          <p className="text-muted text-xs mt-2">Última actualización: {UPDATED}</p>
        </div>
        <p className="text-secondary text-sm leading-relaxed">
          {businessData.legalName}, titular de {businessData.name} (domicilio: {businessData.address}), es responsable del tratamiento de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        </p>
        {SECTIONS.map(s => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-foreground font-semibold">{s.title}</h2>
            <div className="text-secondary text-sm leading-relaxed space-y-2">{s.body}</div>
          </section>
        ))}
        <p className="pt-2"><Link href="/" className="text-brand text-sm hover:opacity-80">← Volver al menú</Link></p>
      </main>
    </div>
  )
}
