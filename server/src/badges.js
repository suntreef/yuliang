import { rateOn, baseCurrency } from './fx.js'
import { totalsAt, snapshotStats, addXP } from './stats.js'
import { inAppNotice } from './notify.js'
import { today, addDays, addMonthsKey, monthKey, round2, clampInt } from './util.js'

const pct = (v, target) => (target > 0 ? Math.max(0, Math.min(1, v / target)) : 0)

export const BADGES = [
  {
    key: 'first_snap', name: '初次落笔', icon: '🎬', desc: '记录第一笔资产快照',
    check: (c) => c.snapshotDays >= 1, progress: (c) => ({ value: c.snapshotDays, target: 1, ratio: pct(c.snapshotDays, 1) }),
  },
  {
    key: 'record_7', name: '七日不断更', icon: '🔥', desc: '连续 7 天记录资产快照',
    check: (c) => c.streak >= 7, progress: (c) => ({ value: c.streak, target: 7, ratio: pct(c.streak, 7) }),
  },
  {
    key: 'record_30', name: '三十而立', icon: '🏅', desc: '连续 30 天记录资产快照',
    check: (c) => c.streak >= 30, progress: (c) => ({ value: c.streak, target: 30, ratio: pct(c.streak, 30) }),
  },
  {
    key: 'networth_100k', name: '六位数', icon: '💎', desc: '净资产(本位币)突破 10 万',
    check: (c) => c.networth >= 100000, progress: (c) => ({ value: c.networth, target: 100000, ratio: pct(c.networth, 100000) }),
  },
  {
    key: 'networth_1m', name: '百万影帝', icon: '👑', desc: '净资产(本位币)突破 100 万',
    check: (c) => c.networth >= 1000000, progress: (c) => ({ value: c.networth, target: 1000000, ratio: pct(c.networth, 1000000) }),
  },
  {
    key: 'zero_fee', name: '零年费大师', icon: '🎟️', desc: '所有卡的免年费条件全部达成',
    check: (c) => c.waiverTotal > 0 && c.waiverMet === c.waiverTotal,
    progress: (c) => ({ value: c.waiverMet, target: c.waiverTotal, ratio: c.waiverTotal > 0 ? pct(c.waiverMet, c.waiverTotal) : 0 }),
  },
  {
    key: 'no_waste', name: '不浪费星人', icon: '🌱', desc: '60 天内到期权益使用率 ≥ 90%',
    check: (c) => c.expiringTotal >= 3 && c.expiringRate >= 0.9,
    progress: (c) => ({ value: round2(c.expiringRate, 2), target: 0.9, ratio: c.expiringTotal >= 3 ? pct(c.expiringRate, 0.9) : 0 }),
  },
  {
    key: 'value_back', name: '回本达人', icon: '💰', desc: '当年已用权益价值超过年费总额',
    check: (c) => c.feesThisYear > 0 && c.usedValueThisYear > c.feesThisYear,
    progress: (c) => ({ value: c.usedValueThisYear, target: c.feesThisYear, ratio: c.feesThisYear > 0 ? pct(c.usedValueThisYear, c.feesThisYear) : 0 }),
  },
  {
    key: 'debt_light', name: '轻装上阵', icon: '🎈', desc: '负债较历史峰值下降 10%',
    check: (c) => c.liabPeak > 0 && c.liabNow <= c.liabPeak * 0.9,
    progress: (c) => {
      const reduced = c.liabPeak > 0 ? (c.liabPeak - c.liabNow) / c.liabPeak : 0
      return { value: round2(reduced * 100, 1), target: 10, ratio: pct(reduced, 0.1) }
    },
  },
  {
    key: 'reporter_12', name: '月月追更', icon: '📺', desc: '连续 12 期月报全部查看',
    check: (c) => c.reportStreak >= 12, progress: (c) => ({ value: c.reportStreak, target: 12, ratio: pct(c.reportStreak, 12) }),
  },
]

// 汇总徽章评估所需的全部指标(月报/徽章进度接口共用)
export function computeBadgeCtx(db, member) {
  const t = today()
  const cur = totalsAt(db, member.id, t)
  const ss = snapshotStats(db, member.id)

  const cards = db.prepare('SELECT * FROM cards WHERE member_id = ? AND archived = 0').all(member.id)
  const waiverCards = cards.filter((c) => c.waiver_type === 'count' || c.waiver_type === 'amount')
  const waiverMet = waiverCards.filter((c) =>
    (c.waiver_type === 'count' && c.waiver_count != null && (c.progress_count || 0) >= c.waiver_count) ||
    (c.waiver_type === 'amount' && c.waiver_amount != null && (c.progress_amount || 0) >= c.waiver_amount)).length

  const year = t.slice(0, 4)
  const nowM = Number(t.slice(5, 7))
  const nowD = Number(t.slice(8, 10))
  const feesThisYear = round2(cards
    .filter((c) => (c.annual_fee || 0) > 0 && (!c.fee_month || c.fee_month < nowM || (c.fee_month === nowM && (c.fee_day || 1) <= nowD)))
    .reduce((s, c) => s + c.annual_fee * rateOn(db, t, c.currency), 0))

  let usedValueThisYear = 0
  const usedBens = db.prepare(`SELECT * FROM benefits WHERE member_id = ? AND archived = 0 AND
    ( (type='count' AND used_count > 0) OR EXISTS(SELECT 1 FROM benefit_usages u WHERE u.benefit_id = benefits.id AND u.used_at LIKE ? || '%') )`)
    .all(member.id, year)
  for (const b of usedBens) {
    if (b.type === 'count') usedValueThisYear += (b.used_count || 0) * (b.value || 0)
    else usedValueThisYear += (b.value || 0)
  }

  const exp = db.prepare(`SELECT * FROM benefits WHERE member_id = ? AND archived = 0 AND type='count'
    AND expire_date IS NOT NULL AND expire_date BETWEEN ? AND ?`).all(member.id, t, addDays(t, 60))
  const expiringTotal = exp.reduce((s, b) => s + (b.total_count || 0), 0)
  const expiringUsed = exp.reduce((s, b) => s + (b.used_count || 0), 0)

  let liabNow = 0
  for (const a of cur.accounts.filter((x) => x.type === 'liability')) liabNow += a.valueBase
  liabNow = round2(liabNow)
  let liabPeak = 0
  const liabSnaps = db.prepare(`SELECT s.value, s.date, a.currency FROM snapshots s
    JOIN accounts a ON a.id = s.account_id WHERE a.member_id = ? AND a.type = 'liability'`).all(member.id)
  for (const s of liabSnaps) liabPeak = Math.max(liabPeak, s.value * rateOn(db, s.date, s.currency))
  liabPeak = round2(liabPeak)

  let reportStreak = 0
  const seenReports = db.prepare(`SELECT period, seen FROM reports WHERE member_id = ? AND type = 'monthly' ORDER BY period DESC LIMIT 24`).all(member.id)
  if (seenReports.length && seenReports[0].period === monthKey(addDays(t, -1))) {
    let mk = seenReports[0].period
    for (const r of seenReports) {
      if (r.period !== mk || !r.seen) break
      reportStreak++
      mk = addMonthsKey(mk, -1)
    }
  }

  return {
    snapshotDays: ss.days, streak: ss.streak, networth: cur.net,
    waiverTotal: waiverCards.length, waiverMet,
    expiringTotal, expiringRate: expiringTotal ? expiringUsed / expiringTotal : 0,
    feesThisYear, usedValueThisYear: round2(usedValueThisYear),
    liabNow, liabPeak, reportStreak,
  }
}

export function evalBadges(db, member) {
  const ctx = computeBadgeCtx(db, member)
  const earnedKeys = new Set(db.prepare('SELECT badge_key FROM member_badges WHERE member_id = ?').all(member.id).map((r) => r.badge_key))
  for (const def of BADGES) {
    if (earnedKeys.has(def.key)) continue
    let hit = false
    try { hit = def.check(ctx) } catch { /* 条件计算失败不阻塞 */ }
    if (!hit) continue
    db.prepare('INSERT INTO member_badges(member_id, badge_key, earned_at) VALUES(?,?,?)').run(member.id, def.key, today())
    addXP(db, member.id, 'badge', 20)
    inAppNotice(db, member.id, `badge:${def.key}`, `解锁徽章:${def.name}`, `${def.desc}。奖励 +20 XP`)
  }
  return ctx
}
