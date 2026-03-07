export function lastUpdatedColor(dateStr?: string): string {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days <= 2) return 'var(--p-green-500, #22c55e)'
  if (days <= 4) return 'var(--p-yellow-500, #eab308)'
  return 'var(--p-red-500, #ef4444)'
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
