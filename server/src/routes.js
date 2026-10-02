import { getKV, setKV, getJSON, setJSON, getMemberSettings, saveMemberSettings, tx } from './db.js'
import { COOKIE, createSession, destroySession, hashPassword, verifyPassword } from './auth.js'
import { baseCurrency, fetchRates, rateOn } from './fx.js'
import { totalsAt, networthSeries, snapshotStats, xpTotal, levelOf, addXP } from './stats.js'
import { BADGES, evalBadges, computeBadgeCtx } from './badges.js'
import { genReminders, runOnce } from './engine.js'
import { today, nowISO, round2, monthKey, addMonthsKey, fmtMoney } from './util.js'

const ACCOUNT_TYPES = ['cash', 'bank', 'invest', 'pension', 'liability', 'points']
const COOKIE_OPTS = { httpOnly: true, path: '/', maxAge: 30 * 24 * 3600, sameSite: 'lax' }
const publicMember = (m) => ({ id: m.id, name: m.name, color: m.color, emoji: m.emoji, hasPassword: !!m.password_hash, isAdmin: !!m.is_admin })
const adminOnly = (req, reply) => {
  if (!req.member) { reply.code(401).send({ error: '未登录' }); return null }
  if (!req.member.is_admin) { reply.code(403).send({ error: '需要管理员权限' }); return null }
  return req.member
}

export default async function routes(app, { db }) {
  // ============ 公开:引导 / 初始化 / 会话 ============
  app.get('/api/bootstrap', async () => {
    const needsSetup = db.prepare('SELECT COUNT(*) AS n FROM members').get().n === 0
    return {
      needsSetup,
      quickEntry: getKV(db, 'quick_entry', '1') !== '0',
      members: needsSetup ? [] : db.prepare('SELECT * FROM members WHERE active = 1 ORDER BY id').all().map(publicMember),
    }
  })

  app.post('/api/setup', async (req, reply) => {
    if (db.prepare('SELECT COUNT(*) AS n FROM members').get().n > 0) return reply.code(400).send({ error: '已完成初始化' })
    const name = String(req.body?.name || '').trim().slice(0, 30)
    if (!name) return reply.code(400).send({ error: '需要一个名字' })
    const pw = req.body?.password ? String(req.body.password) : null
    if (pw && pw.length < 4) return reply.code(400).send({ error: '密码至少 4 位' })
    const info = db.prepare('INSERT INTO members(name, color, emoji, password_hash, is_admin, created_at) VALUES(?,?,?,?,1,?)')
      .run(name, '#E50914', '🎬', hashPassword(pw), nowISO())
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid)
    reply.setCookie(COOKIE, createSession(db, member.id), COOKIE_OPTS)
    return { ok: true }
  })

  app.post('/api/session', async (req, reply) => {
    const member = db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(Number(req.body?.member_id))
    if (!member) return reply.code(404).send({ error: '成员不存在' })
    const quick = getKV(db, 'quick_entry', '1') !== '0'
    if (member.password_hash && !quick) {
      const pw = req.body?.password ? String(req.body.password) : ''
      if (!pw || !verifyPassword(pw, member.password_hash)) {
        return reply.code(401).send({ error: '需要密码', needPassword: true })
      }
    }
    reply.setCookie(COOKIE, createSession(db, member.id), COOKIE_OPTS)
    return { ok: true }
  })

  app.delete('/api/session', async (req, reply) => {
    destroySession(db, req.cookies[COOKIE])
    reply.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  // ============ 我 ============
  app.get('/api/me', async (req) => {
    const m = req.member
    const ss = snapshotStats(db, m.id)
    const mk = today().slice(0, 7)
    const snapThisMonth = db.prepare('SELECT EXISTS(SELECT 1 FROM snapshots WHERE member_id = ? AND date >= ?) AS e').get(m.id, `${mk}-01`).e === 1
    return {
      member: publicMember(m),
      level: levelOf(xpTotal(db, m.id)),
      streak: ss.streak,
      snapshotDays: ss.days,
      snapshotThisMonth: snapThisMonth,
      pendingReminders: db.prepare("SELECT COUNT(*) AS n FROM reminders WHERE member_id = ? AND status = 'pending' AND source_type != 'badge'").get(m.id).n,
      unseenReports: db.prepare('SELECT COUNT(*) AS n FROM reports WHERE member_id = ? AND seen = 0').get(m.id).n,
      base: baseCurrency(db),
    }
  })

  // 成员自助修改自己的资料与密码(管理员边界:不能改 is_admin)
  app.put('/api/me/profile', async (req, reply) => {
    const m = req.member
    const b = req.body || {}
    if (b.password === null) {
      db.prepare('UPDATE members SET password_hash = NULL WHERE id = ?').run(m.id)
    } else if (b.password) {
      const pw = String(b.password)
      if (pw.length < 4) return reply.code(400).send({ error: '密码至少 4 位' })
      db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(pw), m.id)
    }
    db.prepare('UPDATE members SET name=?, color=?, emoji=? WHERE id=?')
      .run(b.name != null ? String(b.name).trim().slice(0, 30) || m.name : m.name,
        /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : m.color,
        b.emoji != null ? String(b.emoji).slice(0, 8) : m.emoji, m.id)
    return publicMember(db.prepare('SELECT * FROM members WHERE id = ?').get(m.id))
  })

  // ============ 账户与快照 ============
  app.get('/api/accounts', async (req) => {
    const t = today()
    const rows = db.prepare('SELECT * FROM accounts WHERE member_id = ? ORDER BY archived, sort, id').all(req.member.id)
    for (const a of rows) {
      const snap = db.prepare('SELECT value, date FROM snapshots WHERE account_id = ? AND date <= ? ORDER BY date DESC, id DESC LIMIT 1').get(a.id, t)
      a.latest_value = snap ? snap.value : null
      a.latest_date = snap ? snap.date : null
      a.value_base = snap ? round2(snap.value * rateOn(db, t, a.currency)) : null
    }
    return rows
  })

  app.post('/api/accounts', async (req, reply) => {
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 50)
    if (!name) return reply.code(400).send({ error: '需要账户名' })
    const type = ACCOUNT_TYPES.includes(b.type) ? b.type : 'cash'
    const currency = String(b.currency || baseCurrency(db)).toUpperCase().slice(0, 3)
    const info = db.prepare('INSERT INTO accounts(member_id, name, type, currency, institution, sort, created_at) VALUES(?,?,?,?,?,?,?)')
      .run(req.member.id, name, type, currency, b.institution ? String(b.institution).slice(0, 50) : null, Number(b.sort) || 0, nowISO())
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid)
  })

  app.put('/api/accounts/:id', async (req, reply) => {
    const a = db.prepare('SELECT * FROM accounts WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!a) return reply.code(404).send({ error: '账户不存在' })
    const b = req.body || {}
    const next = {
      name: b.name != null ? String(b.name).trim().slice(0, 50) || a.name : a.name,
      type: ACCOUNT_TYPES.includes(b.type) ? b.type : a.type,
      currency: b.currency ? String(b.currency).toUpperCase().slice(0, 3) : a.currency,
      institution: b.institution != null ? String(b.institution).slice(0, 50) : a.institution,
      archived: b.archived != null ? (b.archived ? 1 : 0) : a.archived,
    }
    db.prepare('UPDATE accounts SET name=?, type=?, currency=?, institution=?, archived=? WHERE id=?')
      .run(next.name, next.type, next.currency, next.institution, next.archived, a.id)
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(a.id)
  })

  app.delete('/api/accounts/:id', async (req) => {
    const a = db.prepare('SELECT * FROM accounts WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!a) return { ok: true }
    const used = db.prepare('SELECT COUNT(*) AS n FROM snapshots WHERE account_id = ?').get(a.id).n
    if (used > 0) db.prepare('UPDATE accounts SET archived = 1 WHERE id = ?').run(a.id)
    else db.prepare('DELETE FROM accounts WHERE id = ?').run(a.id)
    return { ok: true }
  })

  app.post('/api/snapshots/bulk', async (req, reply) => {
    const b = req.body || {}
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : today()
    const entries = Array.isArray(b.entries) ? b.entries : []
    if (!entries.length) return reply.code(400).send({ error: '没有可保存的快照' })
    const upsert = db.prepare(`INSERT INTO snapshots(member_id, account_id, date, value, note, created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(account_id, date) DO UPDATE SET value = excluded.value, note = excluded.note`)
    tx(db, () => {
      for (const e of entries) {
        const acc = db.prepare('SELECT id FROM accounts WHERE id = ? AND member_id = ?').get(Number(e.account_id), req.member.id)
        if (!acc || !Number.isFinite(Number(e.value))) continue
        upsert.run(req.member.id, acc.id, date, Number(e.value), e.note ? String(e.note).slice(0, 200) : null, nowISO())
      }
    })
    addXP(db, req.member.id, 'snapshot', 10)
    evalBadges(db, req.member)
    return { ok: true, date, totals: totalsAt(db, req.member.id, date) }
  })

  app.get('/api/snapshots/latest', async (req) => {
    const t = today()
    const rows = db.prepare(`SELECT s.account_id, s.value, s.date FROM snapshots s JOIN accounts a ON a.id = s.account_id
      WHERE a.member_id = ? AND s.date = (SELECT MAX(date) FROM snapshots WHERE account_id = s.account_id AND date <= ?)`)
      .all(req.member.id, t)
    return { date: t, entries: rows }
  })

  app.get('/api/networth', async (req) => {
    const days = Math.min(3650, Math.max(7, Number(req.query.days) || 365))
    return { base: baseCurrency(db), series: networthSeries(db, req.member.id, days), totals: totalsAt(db, req.member.id, today()) }
  })

  app.post('/api/import/snapshots', async (req, reply) => {
    const b = req.body || {}
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : today()
    const lines = String(b.csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return reply.code(400).send({ error: 'CSV 内容为空' })
    const base = baseCurrency(db)
    let createdAccounts = 0
    let imported = 0
    const upsertSnap = db.prepare(`INSERT INTO snapshots(member_id, account_id, date, value, created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(account_id, date) DO UPDATE SET value = excluded.value`)
    tx(db, () => {
      for (const line of lines) {
        const cols = line.split(',').map((s) => s.trim())
        if (cols.length < 2) continue
        const [name, valueRaw, ccyRaw, typeRaw] = cols
        const value = Number(valueRaw)
        if (!name || !Number.isFinite(value)) continue // 跳过表头与坏行
        let acc = db.prepare('SELECT * FROM accounts WHERE member_id = ? AND name = ?').get(req.member.id, name)
        if (!acc) {
          const type = ACCOUNT_TYPES.includes(typeRaw) ? typeRaw : 'cash'
          const currency = (ccyRaw || base).toUpperCase().slice(0, 3)
          const info = db.prepare('INSERT INTO accounts(member_id, name, type, currency, created_at) VALUES(?,?,?,?,?)')
            .run(req.member.id, name.slice(0, 50), type, currency, nowISO())
          acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid)
          createdAccounts++
        }
        upsertSnap.run(req.member.id, acc.id, date, value, nowISO())
        imported++
      }
    })
    if (imported) {
      addXP(db, req.member.id, 'snapshot', 10)
      evalBadges(db, req.member)
    }
    return { ok: true, date, imported, createdAccounts }
  })

  // ============ 信用卡 ============
  // 字段整理;node:sqlite 不接受 undefined,统一收敛为 null
  const cardBody = (b, c = {}) => {
    const v = {
      bank: b.bank != null ? String(b.bank).trim().slice(0, 30) || c.bank : c.bank,
      name: b.name != null ? String(b.name).trim().slice(0, 50) || c.name : c.name,
      currency: b.currency ? String(b.currency).toUpperCase().slice(0, 3) : c.currency,
      annual_fee: b.annual_fee != null ? Math.max(0, Number(b.annual_fee) || 0) : c.annual_fee,
      fee_month: b.fee_month != null ? (b.fee_month ? Math.min(12, Math.max(1, Number(b.fee_month) || 1)) : null) : c.fee_month,
      fee_day: b.fee_day != null ? (b.fee_day ? Math.min(28, Math.max(1, Number(b.fee_day) || 1)) : null) : c.fee_day,
      waiver_type: ['none', 'count', 'amount', 'rigid'].includes(b.waiver_type) ? b.waiver_type : c.waiver_type,
      waiver_count: b.waiver_count != null ? (b.waiver_count ? Math.max(1, Number(b.waiver_count) || 1) : null) : c.waiver_count,
      waiver_amount: b.waiver_amount != null ? (b.waiver_amount ? Math.max(0, Number(b.waiver_amount) || 0) : null) : c.waiver_amount,
      notes: b.notes != null ? String(b.notes).slice(0, 500) : c.notes,
    }
    for (const k of Object.keys(v)) if (v[k] === undefined) v[k] = null
    return v
  }

  app.get('/api/cards', async (req) => {
    const t = today()
    const rows = db.prepare('SELECT * FROM cards WHERE member_id = ? ORDER BY archived, id').all(req.member.id)
    for (const c of rows) {
      c.next_fee_date = (c.fee_month && c.fee_day) ? nextFeeDate(t, c.fee_month, c.fee_day) : null
    }
    return rows
  })

  app.post('/api/cards', async (req, reply) => {
    const b = req.body || {}
    if (!String(b.bank || '').trim() || !String(b.name || '').trim()) return reply.code(400).send({ error: '需要银行与卡名' })
    const v = cardBody({ waiver_type: 'none', currency: baseCurrency(db), ...b })
    const info = db.prepare(`INSERT INTO cards(member_id, bank, name, currency, annual_fee, fee_month, fee_day, waiver_type, waiver_count, waiver_amount, progress_year, notes, created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.member.id, v.bank, v.name, v.currency || 'CNY', v.annual_fee, v.fee_month, v.fee_day, v.waiver_type, v.waiver_count, v.waiver_amount, new Date().getFullYear(), v.notes, nowISO())
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(info.lastInsertRowid)
  })

  app.put('/api/cards/:id', async (req, reply) => {
    const c = db.prepare('SELECT * FROM cards WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!c) return reply.code(404).send({ error: '卡片不存在' })
    const v = cardBody(req.body || {}, c)
    const archived = req.body?.archived != null ? (req.body.archived ? 1 : 0) : c.archived
    db.prepare(`UPDATE cards SET bank=?, name=?, currency=?, annual_fee=?, fee_month=?, fee_day=?, waiver_type=?, waiver_count=?, waiver_amount=?, notes=?, archived=? WHERE id=?`)
      .run(v.bank, v.name, v.currency, v.annual_fee, v.fee_month, v.fee_day, v.waiver_type, v.waiver_count, v.waiver_amount, v.notes, archived, c.id)
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(c.id)
  })

  app.delete('/api/cards/:id', async (req) => {
    db.prepare('UPDATE cards SET archived = 1 WHERE id = ? AND member_id = ?').run(Number(req.params.id), req.member.id)
    return { ok: true }
  })

  app.post('/api/cards/:id/progress', async (req, reply) => {
    const c = db.prepare('SELECT * FROM cards WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!c) return reply.code(404).send({ error: '卡片不存在' })
    const year = new Date().getFullYear()
    let pc = c.progress_count || 0
    let pa = c.progress_amount || 0
    if (c.progress_year !== year) { pc = 0; pa = 0 }
    pc += Math.max(0, Number(req.body?.add_count) || 0)
    pa = round2(pa + Math.max(0, Number(req.body?.add_amount) || 0))
    db.prepare('UPDATE cards SET progress_count = ?, progress_amount = ?, progress_year = ? WHERE id = ?').run(pc, pa, year, c.id)
    evalBadges(db, req.member)
    return db.prepare('SELECT * FROM cards WHERE id = ?').get(c.id)
  })

  // ============ 权益 ============
  const benefitBody = (b, c = {}) => {
    const v = {
      card_id: b.card_id !== undefined ? (b.card_id ? Number(b.card_id) || null : null) : c.card_id,
      name: b.name != null ? String(b.name).trim().slice(0, 60) || c.name : c.name,
      type: ['count', 'date', 'amount'].includes(b.type) ? b.type : c.type,
      total_count: b.total_count !== undefined ? (b.total_count ? Math.max(1, Number(b.total_count) || 1) : null) : c.total_count,
      value: b.value !== undefined ? (b.value != null && b.value !== '' ? Math.max(0, Number(b.value) || 0) : null) : c.value,
      currency: b.currency ? String(b.currency).toUpperCase().slice(0, 3) : c.currency,
      expire_date: b.expire_date !== undefined ? (b.expire_date || null) : c.expire_date,
      notes: b.notes != null ? String(b.notes).slice(0, 300) : c.notes,
    }
    for (const k of Object.keys(v)) if (v[k] === undefined) v[k] = null
    return v
  }

  app.get('/api/benefits', async (req) => {
    return db.prepare('SELECT * FROM benefits WHERE member_id = ? ORDER BY archived, (expire_date IS NULL), expire_date, id').all(req.member.id)
  })

  app.post('/api/benefits', async (req, reply) => {
    const b = req.body || {}
    if (!String(b.name || '').trim()) return reply.code(400).send({ error: '需要权益名' })
    if (b.card_id) {
      const card = db.prepare('SELECT id FROM cards WHERE id = ? AND member_id = ?').get(Number(b.card_id), req.member.id)
      if (!card) return reply.code(400).send({ error: '卡片不存在' })
    }
    const v = benefitBody({ currency: baseCurrency(db), ...b })
    const info = db.prepare(`INSERT INTO benefits(member_id, card_id, name, type, total_count, used_count, value, currency, expire_date, notes, created_at)
      VALUES(?,?,?,?,?,0,?,?,?,?,?)`)
      .run(req.member.id, v.card_id, v.name, v.type || 'count', v.total_count, v.value, v.currency || 'CNY', v.expire_date, v.notes, nowISO())
    return db.prepare('SELECT * FROM benefits WHERE id = ?').get(info.lastInsertRowid)
  })

  app.put('/api/benefits/:id', async (req, reply) => {
    const b0 = db.prepare('SELECT * FROM benefits WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!b0) return reply.code(404).send({ error: '权益不存在' })
    const v = benefitBody(req.body || {}, b0)
    const archived = req.body?.archived != null ? (req.body.archived ? 1 : 0) : b0.archived
    db.prepare('UPDATE benefits SET card_id=?, name=?, type=?, total_count=?, value=?, currency=?, expire_date=?, notes=?, archived=? WHERE id=?')
      .run(v.card_id, v.name, v.type, v.total_count, v.value, v.currency, v.expire_date, v.notes, archived, b0.id)
    return db.prepare('SELECT * FROM benefits WHERE id = ?').get(b0.id)
  })

  app.delete('/api/benefits/:id', async (req) => {
    db.prepare('UPDATE benefits SET archived = 1 WHERE id = ? AND member_id = ?').run(Number(req.params.id), req.member.id)
    return { ok: true }
  })

  app.post('/api/benefits/:id/use', async (req, reply) => {
    const b = db.prepare('SELECT * FROM benefits WHERE id = ? AND member_id = ? AND archived = 0').get(Number(req.params.id), req.member.id)
    if (!b) return reply.code(404).send({ error: '权益不存在' })
    if (b.type === 'count' && b.total_count != null && b.used_count >= b.total_count) {
      return reply.code(400).send({ error: '次数已用完' })
    }
    tx(db, () => {
      db.prepare('INSERT INTO benefit_usages(member_id, benefit_id, used_at, note) VALUES(?,?,?,?)')
        .run(req.member.id, b.id, today(), req.body?.note ? String(req.body.note).slice(0, 200) : null)
      db.prepare('UPDATE benefits SET used_count = used_count + 1 WHERE id = ?').run(b.id)
      addXP(db, req.member.id, 'benefit_use', 3)
    })
    evalBadges(db, req.member)
    return db.prepare('SELECT * FROM benefits WHERE id = ?').get(b.id)
  })

  // ============ 提醒 / 通知中心 ============
  app.get('/api/reminders', async (req) => {
    const status = req.query.status === 'all' ? null : (req.query.status || 'pending')
    const rows = status
      ? db.prepare('SELECT * FROM reminders WHERE member_id = ? AND status = ? ORDER BY (level = \'urgent\') DESC, (level = \'warning\') DESC, due_date IS NULL, due_date, id DESC LIMIT 200').all(req.member.id, status)
      : db.prepare('SELECT * FROM reminders WHERE member_id = ? ORDER BY id DESC LIMIT 200').all(req.member.id)
    return rows
  })

  app.post('/api/reminders/:id/ack', async (req, reply) => {
    const r = db.prepare('SELECT * FROM reminders WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!r) return reply.code(404).send({ error: '提醒不存在' })
    const action = req.body?.action === 'dismissed' ? 'dismissed' : 'done'
    db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(action, r.id)
    if (action === 'done' && r.status === 'pending') addXP(db, req.member.id, 'reminder_done', 2)
    return { ok: true }
  })

  // ============ 月报 ============
  app.get('/api/reports', async (req) => {
    const rows = db.prepare('SELECT id, period, type, seen, created_at, data FROM reports WHERE member_id = ? ORDER BY period DESC LIMIT 60').all(req.member.id)
    return rows.map((r) => ({ id: r.id, period: r.period, type: r.type, seen: r.seen, created_at: r.created_at, headline: safeParse(r.data)?.headline || '' }))
  })

  app.get('/api/reports/:id', async (req, reply) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!r) return reply.code(404).send({ error: '报告不存在' })
    return { ...r, data: safeParse(r.data) }
  })

  app.post('/api/reports/:id/seen', async (req) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (r && !r.seen) {
      db.prepare('UPDATE reports SET seen = 1 WHERE id = ?').run(r.id)
      addXP(db, req.member.id, 'report_seen', 5)
      evalBadges(db, req.member)
    }
    return { ok: true }
  })

  // ============ 徽章与 XP ============
  app.get('/api/badges', async (req) => {
    const earned = db.prepare('SELECT badge_key, earned_at FROM member_badges WHERE member_id = ?').all(req.member.id)
    const map = new Map(earned.map((e) => [e.badge_key, e.earned_at]))
    const xp = xpTotal(db, req.member.id)
    const ctx = computeBadgeCtx(db, req.member)
    return {
      badges: BADGES.map((d) => ({
        ...d,
        earned_at: map.get(d.key) || null,
        progress: d.progress ? d.progress(ctx) : null,
      })),
      level: levelOf(xp), xp,
    }
  })

  // ============ 目标 ============
  app.get('/api/goals', async (req) => {
    const totals = totalsAt(db, req.member.id, today())
    const rows = db.prepare('SELECT * FROM goals WHERE member_id = ? ORDER BY done, id DESC').all(req.member.id)
    for (const g of rows) {
      if (g.kind === 'networth') g.current_amount = totals.net
      if (!g.done && g.current_amount >= g.target_amount) {
        db.prepare('UPDATE goals SET done = 1 WHERE id = ?').run(g.id)
        g.done = 1
        addXP(db, req.member.id, 'goal_done', 50)
        db.prepare(`INSERT OR IGNORE INTO reminders(member_id, dedupe_key, source_type, title, body, level, created_at)
          VALUES(?,?,?,?,?,?,?)`)
          .run(req.member.id, `goal:${g.id}`, 'badge', `🎯 目标达成:${g.name}`, `目标金额 ${fmtMoney(g.target_amount, g.currency)} 已达成!奖励 +50 XP`, 'info', nowISO())
      }
    }
    return rows
  })

  app.post('/api/goals', async (req, reply) => {
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 60)
    const target = Number(b.target_amount)
    if (!name || !Number.isFinite(target) || target <= 0) return reply.code(400).send({ error: '需要目标名与目标金额' })
    const info = db.prepare('INSERT INTO goals(member_id, name, kind, target_amount, current_amount, currency, due_date, created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(req.member.id, name, b.kind === 'networth' ? 'networth' : 'manual', target, Number(b.current_amount) || 0,
        String(b.currency || baseCurrency(db)).toUpperCase().slice(0, 3), b.due_date || null, nowISO())
    return db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid)
  })

  app.put('/api/goals/:id', async (req, reply) => {
    const g = db.prepare('SELECT * FROM goals WHERE id = ? AND member_id = ?').get(Number(req.params.id), req.member.id)
    if (!g) return reply.code(404).send({ error: '目标不存在' })
    const b = req.body || {}
    db.prepare('UPDATE goals SET name=?, target_amount=?, current_amount=?, currency=?, due_date=?, done=? WHERE id=?')
      .run(b.name != null ? String(b.name).trim().slice(0, 60) || g.name : g.name,
        b.target_amount != null ? Number(b.target_amount) || g.target_amount : g.target_amount,
        b.current_amount != null ? Number(b.current_amount) || 0 : g.current_amount,
        b.currency ? String(b.currency).toUpperCase().slice(0, 3) : g.currency,
        b.due_date !== undefined ? (b.due_date || null) : g.due_date,
        b.done != null ? (b.done ? 1 : 0) : g.done, g.id)
    return db.prepare('SELECT * FROM goals WHERE id = ?').get(g.id)
  })

  app.delete('/api/goals/:id', async (req) => {
    db.prepare('DELETE FROM goals WHERE id = ? AND member_id = ?').run(Number(req.params.id), req.member.id)
    return { ok: true }
  })

  // ============ 成员设置 ============
  app.get('/api/settings/member', async (req) => {
    return getMemberSettings(db, req.member.id)
  })

  app.put('/api/settings/member', async (req, reply) => {
    const b = req.body || {}
    const st = getMemberSettings(db, req.member.id)
    if (Array.isArray(b.thresholds)) {
      st.thresholds = b.thresholds.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 90).sort((x, y) => y - x).slice(0, 6)
    }
    if (Array.isArray(b.channels)) {
      st.channels = b.channels
        .filter((c) => c && (c.type === 'webhook' || c.type === 'email'))
        .slice(0, 10)
        .map((c) => (c.type === 'webhook'
          ? { type: 'webhook', url: String(c.url || '').slice(0, 500) }
          : { type: 'email', to: String(c.to || '').slice(0, 200) }))
        .filter((c) => (c.type === 'webhook' ? /^https?:\/\//.test(c.url) : /.+@.+\..+/.test(c.to)))
    }
    if (b.digest_hour !== undefined) {
      st.digest_hour = b.digest_hour == null || b.digest_hour === '' ? null : Math.min(23, Math.max(0, Number(b.digest_hour) || 0))
    }
    saveMemberSettings(db, req.member.id, st)
    return getMemberSettings(db, req.member.id)
  })

  // ============ 管理员 ============
  app.get('/api/settings/global', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    const smtp = getJSON(db, 'smtp', null)
    return {
      base_currency: baseCurrency(db),
      quick_entry: getKV(db, 'quick_entry', '1') !== '0',
      fx_manual: getJSON(db, 'fx_manual', {}),
      fx_last_fetch: getJSON(db, 'fx_last_fetch', null),
      smtp: smtp ? { ...smtp, pass: smtp.pass ? '******' : '' } : null,
      hasSmtpPass: !!(smtp && smtp.pass),
    }
  })

  app.put('/api/settings/global', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    const b = req.body || {}
    if (b.base_currency) setKV(db, 'base_currency', String(b.base_currency).toUpperCase().slice(0, 3))
    if (b.quick_entry !== undefined) setKV(db, 'quick_entry', b.quick_entry ? '1' : '0')
    if (b.fx_manual !== undefined) {
      const clean = {}
      for (const [k, v] of Object.entries(b.fx_manual || {})) {
        const n = Number(v)
        if (/^[A-Z]{3}$/.test(k) && Number.isFinite(n) && n > 0) clean[k] = n
      }
      setJSON(db, 'fx_manual', clean)
    }
    if (b.smtp !== undefined) {
      const old = getJSON(db, 'smtp', null)
      if (b.smtp === null) setJSON(db, 'smtp', null)
      else {
        const s = {
          host: String(b.smtp.host || '').slice(0, 200),
          port: Number(b.smtp.port) || 587,
          secure: !!b.smtp.secure,
          user: String(b.smtp.user || '').slice(0, 200),
          from: String(b.smtp.from || '').slice(0, 200),
          pass: b.smtp.pass && b.smtp.pass !== '******' ? String(b.smtp.pass) : (old?.pass || ''),
        }
        setJSON(db, 'smtp', s.host ? s : null)
      }
    }
    return { ok: true }
  })

  app.get('/api/admin/members', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    return db.prepare('SELECT * FROM members ORDER BY id').all().map(publicMember)
  })

  app.post('/api/admin/members', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 30)
    if (!name) return reply.code(400).send({ error: '需要名字' })
    const pw = b.password ? String(b.password) : null
    if (pw && pw.length < 4) return reply.code(400).send({ error: '密码至少 4 位' })
    const info = db.prepare('INSERT INTO members(name, color, emoji, password_hash, is_admin, created_at) VALUES(?,?,?,?,?,?)')
      .run(name, /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : pickColor(), String(b.emoji || '🍿').slice(0, 8), hashPassword(pw), b.is_admin ? 1 : 0, nowISO())
    return publicMember(db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid))
  })

  app.put('/api/admin/members/:id', async (req, reply) => {
    const admin = adminOnly(req, reply)
    if (!admin) return
    const m = db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id))
    if (!m) return reply.code(404).send({ error: '成员不存在' })
    const b = req.body || {}
    if (b.active === false && m.id === admin.id) return reply.code(400).send({ error: '不能停用自己' })
    if (b.active === false && m.is_admin) {
      const admins = db.prepare('SELECT COUNT(*) AS n FROM members WHERE is_admin = 1 AND active = 1').get().n
      if (admins <= 1) return reply.code(400).send({ error: '至少保留一位启用中的管理员' })
    }
    const pw = b.password === null ? null : (b.password ? String(b.password) : undefined)
    if (pw !== undefined && pw !== null && pw.length < 4) return reply.code(400).send({ error: '密码至少 4 位' })
    db.prepare('UPDATE members SET name=?, color=?, emoji=?, password_hash=?, active=? WHERE id=?')
      .run(b.name != null ? String(b.name).trim().slice(0, 30) || m.name : m.name,
        /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : m.color,
        b.emoji != null ? String(b.emoji).slice(0, 8) : m.emoji,
        pw === undefined ? m.password_hash : hashPassword(pw),
        b.active != null ? (b.active ? 1 : 0) : m.active, m.id)
    return publicMember(db.prepare('SELECT * FROM members WHERE id = ?').get(m.id))
  })

  app.post('/api/admin/fx-refresh', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    const ok = await fetchRates(db)
    return { ok, fx_last_fetch: getJSON(db, 'fx_last_fetch', null) }
  })

  app.post('/api/admin/engine-run', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    await runOnce(db)
    return { ok: true }
  })

  app.get('/api/admin/export', async (req, reply) => {
    if (!adminOnly(req, reply)) return
    const dump = { exported_at: nowISO(), app: 'yuliang' }
    for (const table of ['members', 'member_settings', 'accounts', 'snapshots', 'cards', 'benefits', 'benefit_usages', 'reminders', 'reports', 'goals', 'xp_events', 'member_badges', 'fx_rates']) {
      dump[table] = db.prepare(`SELECT * FROM ${table}`).all()
    }
    dump.kv = db.prepare('SELECT * FROM kv').all().filter((r) => !r.key.startsWith('digest_sent'))
    reply.header('content-disposition', 'attachment; filename="yuliang-backup.json"')
    return dump
  })
}

// ---- helpers ----
function safeParse(s) { try { return JSON.parse(s) } catch { return null } }
function nextFeeDate(t, month, day) {
  const [y] = t.split('-').map(Number)
  const clamp = (yy) => new Date(yy, month - 1, Math.min(day, new Date(yy, month, 0).getDate()))
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  let c = clamp(y)
  if (fmt(c) < t) c = clamp(y + 1)
  return fmt(c)
}
const PALETTE = ['#E50914', '#0071EB', '#F5B50A', '#2BB673', '#8B5CF6', '#FF6B35', '#00A8A8', '#D63384']
function pickColor() { return PALETTE[Math.floor(Math.random() * PALETTE.length)] }
