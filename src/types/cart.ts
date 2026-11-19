export interface CartItem {
  id: string
  productId: string
  name: string
  quantity: number
  unitPrice: number
  selectedVariants: Record<string, string>
  variantLabels: Record<string, string>
  variantExtra: number
  subtotal: number
}
