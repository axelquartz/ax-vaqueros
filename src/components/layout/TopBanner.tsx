import bannerData from '@/data/topBanner.json'

const wrapper = 'max-w-[90vw] mx-auto w-full mt-3 mb-1 rounded-2xl overflow-hidden'

export function TopBanner() {
  if (!bannerData.active || !bannerData.image) return null

  const img = (
    <img
      src={bannerData.image}
      alt={bannerData.alt}
      className="w-full object-cover block"
    />
  )

  if (bannerData.href) {
    return (
      <a href={bannerData.href} target="_blank" rel="noopener noreferrer" className={wrapper}>
        {img}
      </a>
    )
  }

  return <div className={wrapper}>{img}</div>
}
