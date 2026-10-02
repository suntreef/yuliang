import { baseCurrency, rateOn } from './fx.js'
import { totalsAt } from './stats.js'
import { today, monthStart, monthEnd, monthKey, addMonthsKey, round2, fmtMoney, pad, nowISO } from './util.js'

// 生成某成员某月(YYYY-MM)月报;已存在则跳过(保留 seen 状态)
export function genMonthlyReport(db, member, mk) {
  const base = baseCurrency(db)
  const start = monthStart(mk)
  const end = monthEnd(mk)
  const prevEnd = monthEnd(addMonthsKey(mk, -1))
  const cur = totalsAt(db, member.id, end)
  const prev = totalsAt(db, member.id, prevEnd)
  if (mk >= today().slice(0, 7)) return null // 只生成已完整结束的月份

  const movers = cur.accounts
    .map((a) => {
      const p = prev.accounts.find((x) => x.id === a.id)
      return { id: a.id, name: a.name, type: a.type, currency: a.currency, delta: round2(a.valueBase - (p ? p.valueBase : 0)) }
    })
    .filter((m) => m.delta !== 0)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 3)

  const cards = db.prepare('SELECT * FROM cards WHERE member_id = ? AND archived = 0').all(member.id)
  const [y, m] = mk.split('-').map(Number)
  const feeItems = []
  for (const c of cards) {
    if (!c.annual_fee || c.fee_month !== m) continue
    const feeDay = Math.min(c.fee_day || 1, new Date(y, m, 0).getDate())
    const feeDate = `${mk}-${pad(feeDay)}`
    if (feeDate <= today()) {
      feeItems.push({ card_id: c.id, bank: c.bank, name: c.name, fee: c.annual_fee, currency: c.currency, feeBase: round2(c.annual_fee * rateOn(db, feeDate, c.currency)), date: feeDate })
    }
  }
  const feesPaid = { total: round2(feeItems.reduce((s, f) => s + f.feeBase, 0)), items: feeItems }

  const bens = db.prepare('SELECT * FROM benefits WHERE member_id = ? AND archived = 0 AND expire_date BETWEEN ? AND ?')
    .all(member.id, start, end)
  const wastedItems = bens
    .map((b) => {
      const remain = b.type === 'count' ? Math.max(0, (b.total_count || 0) - (b.used_count || 0)) : 1
      const valueBase = round2(remain * (b.value || 0) * rateOn(db, b.expire_date, b.currency))
      return { id: b.id, name: b.name, value: valueBase, currency: b.currency, expire_date: b.expire_date, remain }
    })
    .filter((x) => x.value > 0)
  const wasted = { total: round2(wastedItems.reduce((s, w) => s + w.value, 0)), items: wastedItems }

  let fxEffect = 0
  for (const a of cur.accounts) {
    if (a.currency === base) continue
    const p = prev.accounts.find((x) => x.id === a.id)
    if (!p || !p.snapDate || !a.snapDate) continue
    fxEffect += a.value * (rateOn(db, end, a.currency) - rateOn(db, prevEnd, a.currency))
  }

  const badges = db.prepare(`SELECT badge_key, earned_at FROM member_badges WHERE member_id = ? AND earned_at BETWEEN ? AND ?`)
    .all(member.id, start, end)
    .map((r) => r.badge_key)
  const snapshotCount = db.prepare('SELECT COUNT(DISTINCT date) AS n FROM snapshots WHERE member_id = ? AND date BETWEEN ? AND ?').get(member.id, start, end).n
  const cardsAdded = db.prepare(`SELECT COUNT(*) AS n FROM cards WHERE member_id = ? AND created_at LIKE ? || '%'`).get(member.id, mk).n

  const data = {
    period: mk,
    networth: {
      start: prev.net, end: cur.net, delta: round2(cur.net - prev.net),
      deltaPct: prev.net !== 0 ? round2(((cur.net - prev.net) / Math.abs(prev.net)) * 100) : null,
      assets: cur.assets, liabilities: cur.liabilities,
    },
    movers, feesPaid, wasted,
    fxEffect: round2(fxEffect),
    snapshotCount, cardsAdded, badges,
    headline: `${mk.slice(0, 4)} 年 ${Number(mk.slice(5, 7))} 月:净资产 ${fmtMoney(cur.net, base)}`,
  }
  db.prepare(`INSERT INTO reports(member_id, period, type, data, seen, created_at) VALUES(?,?,?,?,0,?)
    ON CONFLICT(member_id, period) DO NOTHING`)
    .run(member.id, mk, 'monthly', JSON.stringify(data), nowISO())
  return data
}

// 启动补跑:把成员历史上缺失的月报(最多回溯 24 个月)补齐
export function genMissingReports(db) {
  const members = db.prepare('SELECT * FROM members WHERE active = 1').all()
  const thisMk = today().slice(0, 7)
  for (const m of members) {
    const earliest = db.prepare(`SELECT MIN(date) AS d FROM (
      SELECT MIN(date) AS date FROM snapshots WHERE member_id = ?
      UNION SELECT MIN(substr(created_at,1,10)) FROM cards WHERE member_id = ?
      UNION SELECT MIN(substr(created_at,1,10)) FROM accounts WHERE member_id = ?)`).get(m.id, m.id, m.id).d
    if (!earliest) continue
    let mk = monthKey(earliest)
    if (thisMk.slice(0, 4) !== mk.slice(0, 4)) {
      // 防御:最早记录异常时至少从 24 个月前开始
      const floorMk = addMonthsKey(thisMk, -24)
      if (mk < floorMk) mk = floorMk
    }
    while (mk < thisMk) {
      genMonthlyReport(db, m, mk)
      mk = addMonthsKey(mk, 1)
    }
  }
}
