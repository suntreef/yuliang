import { getMemberSettings, getKV, setKV } from './db.js'
import { fetchRates } from './fx.js'
import { today, daysBetween, nextMonthlyDate, nowISO, fmtMoney, round2 } from './util.js'
import { evalBadges } from './badges.js'
import { genMissingReports } from './reports.js'
import { deliverReminders } from './notify.js'

const activeMembers = (db) => db.prepare('SELECT * FROM members WHERE active = 1').all()

// 生成"今天恰好命中阈值"的提醒;dedupe_key 幂等,返回本次新建的
export function genReminders(db, member) {
  const t = today()
  const st = getMemberSettings(db, member.id)
  const thresholds = [...new Set([...(st.thresholds || []), 0])]
  const created = []
  const ins = (r) => {
    const info = db.prepare(`INSERT OR IGNORE INTO reminders
      (member_id, dedupe_key, source_type, source_id, title, body, due_date, level, created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(member.id, r.key, r.source_type, r.source_id, r.title, r.body, r.due_date, r.level, nowISO())
    if (info.changes > 0) created.push({ id: info.lastInsertRowid, ...r })
  }

  for (const c of db.prepare('SELECT * FROM cards WHERE member_id = ? AND archived = 0').all(member.id)) {
    if (!c.annual_fee || !c.fee_month || !c.fee_day) continue
    const feeDate = nextMonthlyDate(c.fee_month, c.fee_day)
    const d = daysBetween(t, feeDate)
    for (const th of thresholds) {
      if (d !== th) continue
      const level = th <= 1 ? 'urgent' : th <= 7 ? 'warning' : 'info'
      let hint = ''
      if (c.waiver_type === 'count' && c.waiver_count) {
        const need = c.waiver_count - (c.progress_count || 0)
        if (need > 0) hint = `免年费条件未达成——还差 ${need} 笔消费即可免年费,冲一冲!`
      } else if (c.waiver_type === 'amount' && c.waiver_amount) {
        const need = round2(c.waiver_amount - (c.progress_amount || 0))
        if (need > 0) hint = `免年费条件未达成——还差 ${fmtMoney(need, c.currency)} 消费即可免年费。`
      } else if (c.waiver_type === 'none') {
        hint = '该卡为刚性年费,记得核对权益是否用回本。'
      }
      ins({
        key: `fee:${c.id}:${feeDate}:${th}`, source_type: 'fee', source_id: c.id, due_date: feeDate, level,
        title: `年费提醒:${c.bank} ${c.name}`,
        body: `${th === 0 ? '今天' : '还有 ' + th + ' 天'}将扣收年费 ${fmtMoney(c.annual_fee, c.currency)}。${hint}`,
      })
    }
  }

  for (const b of db.prepare('SELECT * FROM benefits WHERE member_id = ? AND archived = 0 AND expire_date IS NOT NULL').all(member.id)) {
    // 次数型已用完就没有"浪费"可言,不再发到期提醒
    if (b.type === 'count' && b.total_count != null && (b.used_count || 0) >= b.total_count) continue
    const d = daysBetween(t, b.expire_date)
    for (const th of thresholds) {
      if (d !== th) continue
      const level = th <= 1 ? 'urgent' : th <= 7 ? 'warning' : 'info'
      const remain = b.type === 'count' ? Math.max(0, (b.total_count || 0) - (b.used_count || 0)) : null
      const value = b.type === 'count' ? round2(remain * (b.value || 0)) : round2(b.value || 0)
      const remainText = b.type === 'count' ? `还剩 ${remain} 次` : '尚未使用,即将作废'
      ins({
        key: `benefit:${b.id}:${b.expire_date}:${th}`, source_type: 'benefit', source_id: b.id, due_date: b.expire_date, level,
        title: `权益到期:${b.name}`,
        body: `${th === 0 ? '今天' : '还有 ' + th + ' 天'}过期,${remainText},价值约 ${fmtMoney(value, b.currency)}——再不用就浪费了!`,
      })
    }
  }
  return created
}

// 免密推送模式:新提醒立即发渠道;摘要模式由 digestTick 在指定小时合并发送
export async function deliverUnnotified(db) {
  for (const m of activeMembers(db)) {
    const st = getMemberSettings(db, m.id)
    if (st.digest_hour != null) continue
    const list = db.prepare("SELECT * FROM reminders WHERE member_id = ? AND notified = 0 AND source_type != 'badge'").all(m.id)
    await deliverReminders(db, m, list)
  }
}

export async function digestTick(db) {
  const t = today()
  const h = new Date().getHours()
  for (const m of activeMembers(db)) {
    const st = getMemberSettings(db, m.id)
    if (st.digest_hour == null || st.digest_hour !== h) continue
    const key = `digest_sent_${m.id}`
    if (getKV(db, key) === t) continue
    const list = db.prepare("SELECT * FROM reminders WHERE member_id = ? AND notified = 0 AND source_type != 'badge'").all(m.id)
    await deliverReminders(db, m, list)
    setKV(db, key, t)
  }
}

export async function runOnce(db) {
  await fetchRates(db)
  for (const m of activeMembers(db)) {
    genReminders(db, m)
    evalBadges(db, m)
  }
  genMissingReports(db)
  await deliverUnnotified(db)
}

let started = false
export function startEngine(db) {
  if (started) return
  started = true
  const run = () => runOnce(db).catch((e) => console.error('[engine]', e))
  setTimeout(run, 2000) // 启动补跑
  const schedule = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(0, 5, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    setTimeout(() => { run(); schedule() }, next - now)
  }
  schedule()
  setInterval(() => digestTick(db).catch((e) => console.error('[digest]', e)), 5 * 60 * 1000)
}
