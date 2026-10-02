import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'
import { COOKIE, memberForToken } from './auth.js'
import routes from './routes.js'
import { startEngine } from './engine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, '..', 'data')
const PORT = Number(process.env.PORT) || 8080

const db = openDb(DATA_DIR)
const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 })
await app.register(cookie)

// 静态资源与公开 API 之外,一律要求会话
const PUBLIC_APIS = new Set(['/api/bootstrap', '/api/setup', '/api/session'])
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/api')) return
  if (PUBLIC_APIS.has(req.url.split('?')[0])) return
  const member = memberForToken(db, req.cookies[COOKIE])
  if (!member) return reply.code(401).send({ error: '请先选择档案' })
  req.member = member
})

await app.register(routes, { db })

const distV2 = path.join(ROOT, '..', 'web-v2', 'dist')
const distV1 = path.join(ROOT, '..', 'web', 'dist')
if (fs.existsSync(distV1)) {
  await app.register(fastifyStatic, { root: distV1, prefix: '/v1/', decorateReply: false })
}
let v2Ready = false
if (fs.existsSync(distV2)) {
  await app.register(fastifyStatic, { root: distV2, prefix: '/' })
  v2Ready = true
} else if (fs.existsSync(distV1)) {
  await app.register(fastifyStatic, { root: distV1, prefix: '/' })
}
if (v2Ready || fs.existsSync(distV1)) {
  const primary = v2Ready ? distV2 : distV1
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'not found' })
    if (req.url.startsWith('/v1') && fs.existsSync(distV1)) return reply.sendFile('index.html', distV1)
    return reply.sendFile('index.html', primary)
  })
}

startEngine(db)
app.listen({ port: PORT, host: '0.0.0.0' })
  .then(() => console.log(`[assetflix] listening on http://0.0.0.0:${PORT} · data: ${DATA_DIR}`))
  .catch((e) => { console.error('[assetflix] failed to start:', e); process.exit(1) })
