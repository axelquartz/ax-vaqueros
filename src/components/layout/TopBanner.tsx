import bannerData from '@/data/topBanner.json'

export function TopBanner() {
  if (!bannerData.active || !bannerData.image) return null

  const img = (
    <img
      src={bannerData.image}
      alt={bannerData.alt}
      className="w-full object-cover"
      style={{ display: 'block' }}
    />
  )

  if (bannerData.href) {
    return (
      <a href={bannerData.href} target="_blank" rel="noopener noreferrer" className="block w-full">
        {img}
      </a>
    )
  }

  return <div className="w-full">{img}</div>
}
