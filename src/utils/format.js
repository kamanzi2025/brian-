export const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const today = () => new Date().toISOString().split('T')[0]

export const nowIso = () => new Date().toISOString()

export const newId = () => crypto.randomUUID()
