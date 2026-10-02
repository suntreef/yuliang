export const pad = (n) => String(n).padStart(2, '0')
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => fmtDate(new Date())
export const nowISO = () => {
  const d = new Date()
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return fmtDate(d)
}
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000)
}
export const monthKey = (s) => s.slice(0, 7)
export const monthStart = (mk) => mk + '-01'
export function monthEnd(mk) {
  const [y, m] = mk.split('-').map(Number)
  return fmtDate(new Date(y, m, 0))
}
export function addMonthsKey(mk, n) {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
// fee_month/fee_day 在今天或未来的最近一个扣费日(2 月 30 日之类的非法日期自动收敛到月末)
export function nextMonthlyDate(month, day) {
  const now = new Date()
  const build = (y) => new Date(y, month - 1, Math.min(day, new Date(y, month, 0).getDate()))
  let c = build(now.getFullYear())
  if (fmtDate(c) < today()) c = build(now.getFullYear() + 1)
  return fmtDate(c)
}
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const fmtMoney = (n, ccy = 'CNY') => {
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: ccy, maximumFractionDigits: 2 }).format(n || 0)
  } catch { return `${round2(n)} ${ccy}` }
}
export function clampInt(v, min, max, def) {
  const n = Number.parseInt(v, 10)
  if (Number.isNaN(n)) return def
  return Math.min(max, Math.max(min, n))
}
