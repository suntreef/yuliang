import { rateOn, baseCurrency } from './fx.js'
import { today, addDays, addMonthsKey, round2, nowISO } from './util.js'

export function activeAccounts(db, memberId) {
  return db.prepare('SELECT * FROM accounts WHERE member_id = ? AND archived = 0 ORDER BY sort, id').all(memberId)
}

// 某一天(含)前每账户最新快照 → 折本位币汇总;负债账户记正数,净值 = 资产 − 负债
export function totalsAt(db, memberId, date) {
  const accounts = activeAccounts(db, memberId)
  let assets = 0
  let liabilities = 0
  const detail = []
  for (const a of accounts) {
    const snap = db.prepare('SELECT * FROM snapshots WHERE account_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1').get(a.id, date)
    const value = snap ? snap.value : 0
    const valueBase = round2(value * rateOn(db, date, a.currency))
    if (a.type === 'liability') liabilities += valueBase
    else assets += valueBase
    detail.push({ ...a, value, valueBase, snapDate: snap ? snap.date : null })
  }
  return { date, accounts: detail, assets: round2(assets), liabilities: round2(liabilities), net: round2(assets - liabilities) }
}

// 净资产日序列:一遍扫描快照,按日推进
export function networthSeries(db, memberId, days = 365) {
  const end = today()
  const start = addDays(end, -(days - 1))
  const accounts = activeAccounts(db, memberId)
  const byAcc = new Map()
  const snaps = db.prepare(`SELECT s.account_id, s.date, s.value FROM snapshots s
    JOIN accounts a ON a.id = s.account_id WHERE a.member_id = ? AND s.date <= ? ORDER BY s.date`).all(memberId, end)
  for (const s of snaps) {
    if (!byAcc.has(s.account_id)) byAcc.set(s.account_id, [])
    byAcc.get(s.account_id).push(s)
  }
  const idx = new Map()
  const cur = new Map()
  for (const a of accounts) {
    const list = byAcc.get(a.id) || []
    let i = 0
    while (i < list.length && list[i].date < start) { cur.set(a.id, list[i].value); i++ }
    idx.set(a.id, i)
  }
  const rateCache = new Map()
  const rate = (date, ccy) => {
    const k = date + '|' + ccy
    if (!rateCache.has(k)) rateCache.set(k, rateOn(db, date, ccy))
    return rateCache.get(k)
  }
  const points = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    let assets = 0
    let liab = 0
    for (const a of accounts) {
      const list = byAcc.get(a.id) || []
      const i = idx.get(a.id)
      if (i < list.length && list[i].date <= d) { cur.set(a.id, list[i].value); idx.set(a.id, i + 1) }
      const vb = (cur.get(a.id) || 0) * rate(d, a.currency)
      if (a.type === 'liability') liab += vb
      else assets += vb
    }
    points.push({ date: d, assets: round2(assets), liabilities: round2(liab), net: round2(assets - liab) })
  }
  return points
}

export function snapshotStats(db, memberId) {
  const dates = db.prepare('SELECT DISTINCT date FROM snapshots WHERE member_id = ? ORDER BY date').all(memberId).map((r) => r.date)
  let streak = 0
  if (dates.length) {
    let d = today()
    if (!dates.includes(d)) d = addDays(d, -1)
    while (dates.includes(d)) { streak++; d = addDays(d, -1) }
  }
  // 连囤:连续有盘点的月数(复盘以月为周期)
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))]
  let monthStreak = 0
  if (months.length) {
    let mk = today().slice(0, 7)
    if (!months.includes(mk)) mk = addMonthsKey(mk, -1)
    while (months.includes(mk)) { monthStreak++; mk = addMonthsKey(mk, -1) }
  }
  return { days: dates.length, streak, monthStreak, lastDate: dates[dates.length - 1] || null }
}

export const LEVELS = [[0, '新影迷'], [50, '群演'], [150, '资深剧迷'], [300, '影评人'], [600, '制片人'], [1000, '监制'], [1600, '导演']]
export function xpTotal(db, memberId) {
  return db.prepare('SELECT COALESCE(SUM(xp),0) AS s FROM xp_events WHERE member_id = ?').get(memberId).s
}
export function levelOf(xp) {
  let lv = LEVELS[0]
  for (const l of LEVELS) if (xp >= l[0]) lv = l
  const next = LEVELS.find((l) => l[0] > xp)
  return { xp, title: lv[1], min: lv[0], next: next ? { title: next[1], at: next[0] } : null }
}
export function addXP(db, memberId, action, xp) {
  db.prepare('INSERT INTO xp_events(member_id, action, xp, created_at) VALUES(?,?,?,?)').run(memberId, action, xp, nowISO())
}
