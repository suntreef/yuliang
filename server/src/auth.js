import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { today } from './util.js'

export const COOKIE = 'assetflix_session'
const SESSION_DAYS = 30

export function createSession(db, memberId) {
  const token = crypto.randomBytes(32).toString('hex')
  const exp = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  db.prepare('INSERT INTO sessions(token, member_id, expires_at) VALUES(?,?,?)').run(token, memberId, exp)
  return token
}
export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}
export function memberForToken(db, token) {
  if (!token) return null
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!s) return null
  if (s.expires_at < new Date().toISOString()) {
    destroySession(db, token)
    return null
  }
  return db.prepare('SELECT * FROM members WHERE id = ? AND active = 1').get(s.member_id) || null
}

export function hashPassword(pw) {
  return pw ? bcrypt.hashSync(pw, 10) : null
}
export function verifyPassword(pw, hash) {
  return !!hash && !!pw && bcrypt.compareSync(pw, hash)
}

// 需要登录的路由用;request.member 已由 index.js 的守卫挂上
export function requireMember(req, reply) {
  if (!req.member) {
    reply.code(401).send({ error: '请先选择档案' })
    return null
  }
  return req.member
}
export function requireAdmin(req, reply) {
  const m = requireMember(req, reply)
  if (!m) return null
  if (!m.is_admin) {
    reply.code(403).send({ error: '需要管理员权限' })
    return null
  }
  return m
}
