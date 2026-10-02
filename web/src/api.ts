async function handle(r: Response) {
  const body = await r.json().catch(() => null)
  if (!r.ok) {
    const err: any = new Error(body?.error || `HTTP ${r.status}`)
    err.status = r.status
    err.body = body
    throw err
  }
  return body
}

export const api = {
  get: (url: string) => fetch(url).then(handle),
  post: (url: string, body?: any) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(handle),
  put: (url: string, body?: any) =>
    fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(handle),
  del: (url: string, body?: any) =>
    fetch(url, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(handle),
}

export const fmtMoney = (n: any, ccy = 'CNY') => {
  const v = Number(n) || 0
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: ccy, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${ccy}`
  }
}
export const fmtCompact = (n: any, ccy = 'CNY') => {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)} 亿 ${ccy}`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)} 万 ${ccy}`
  return `${sign}${abs.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${ccy}`
}
export const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const daysUntil = (date?: string | null) => {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
