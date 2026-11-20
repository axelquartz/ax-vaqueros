/* eslint-disable @next/next/no-img-element */

type LogoProps = {
  /** long: cuerno + "VAQUERO'S" · small: solo el cuerno */
  variant?: 'long' | 'small'
  className?: string
}

const SOURCES = {
  long:  { src: '/images/brand/logo-long.png',  width: 1600, height: 193 },
  small: { src: '/images/brand/logo-small.png', width: 640,  height: 298 },
} as const

export function Logo({ variant = 'long', className = '' }: LogoProps) {
  const { src, width, height } = SOURCES[variant]
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt="Vaquero's"
      className={`w-auto select-none ${className}`}
      draggable={false}
    />
  )
}
