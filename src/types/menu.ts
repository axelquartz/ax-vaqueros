export interface VariantOption {
  id: string
  label: string
  price: number
}

export interface VariantGroup {
  label: string
  required: boolean
  options: VariantOption[]
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  available: boolean
  featured: boolean
  variantGroups: string[]
  variants?: Record<string, VariantGroup>
  image: string | null
}

export interface Category {
  id: string
  label: string
  emoji: string
}

export interface MenuData {
  categories: Category[]
  variants: Record<string, VariantGroup>
  products: Product[]
}
