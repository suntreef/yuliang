import nodemailer from 'nodemailer'
import { getJSON, getMemberSettings } from './db.js'
import { nowISO } from './util.js'

async function sendWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })
  } catch (e) { console.error('[notify] webhook failed:', e.message) }
}

let mailer = null
let mailerKey = ''
function getMailer(smtp) {
  const key = JSON.stringify(smtp)
  if (mailer && mailerKey === key) return mailer
  mailer = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: !!smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  })
  mailerKey = key
  return mailer
}

async function sendEmail(smtp, to, subject, text) {
  try {
    await getMailer(smtp).sendMail({ from: smtp.from || smtp.user, to, subject, text })
  } catch (e) { console.error('[notify] email failed:', e.message) }
}

// 把一批提醒分发到成员配置的所有渠道;完成后标记 notified
export async function deliverReminders(db, member, reminders) {
  if (!reminders.length) return
  const st = getMemberSettings(db, member.id)
  const smtp = getJSON(db, 'smtp', null)
  for (const ch of st.channels || []) {
    if (ch.type === 'webhook' && ch.url) {
      for (const r of reminders) {
        await sendWebhook(ch.url, {
          app: 'yuliang', member: member.name, source: r.source_type,
          level: r.level, title: r.title, body: r.body, due_date: r.due_date,
        })
      }
    } else if (ch.type === 'email' && ch.to && smtp) {
      const text = reminders.map((r) => `[${r.level.toUpperCase()}] ${r.title}\n${r.body || ''}\n到期:${r.due_date || '-'}\n`).join('\n')
      await sendEmail(smtp, ch.to, `余粮 · ${reminders.length} 条提醒`, text)
    }
  }
  db.prepare(`UPDATE reminders SET notified = 1 WHERE id IN (${reminders.map(() => '?').join(',')})`)
    .run(...reminders.map((r) => r.id))
}

// 站内通知:徽章解锁等不进推送渠道、只进通知中心的事件
export function inAppNotice(db, memberId, dedupeKey, title, body, dueDate = null) {
  db.prepare(`INSERT OR IGNORE INTO reminders(member_id, dedupe_key, source_type, source_id, title, body, due_date, level, created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(memberId, dedupeKey, 'badge', null, title, body, dueDate, 'info', nowISO())
}
