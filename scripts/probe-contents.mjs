// 探针:分离 contents API 嵌套路径 404 的成因
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = fs.readFileSync(path.join(ROOT, '.token'), 'utf8').trim()
const REPO = 'suntreef/yuliang'
const H = { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'yuliang-probe' }
const content = Buffer.from('probe ' + Date.now()).toString('base64')

const zen = await fetch(`https://api.github.com/repos/${REPO}/contents/`, { headers: H })
const listing = await zen.json()
console.log('root listing:', zen.status, '| files:', Array.isArray(listing) ? listing.map((f) => f.name).join(',') : JSON.stringify(listing).slice(0, 120))

async function put(p) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${p}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ message: 'probe', content, branch: 'main' }),
  })
  const b = await r.json()
  console.log(`PUT ${p} →`, r.status, r.status === 200 ? '(ok)' : JSON.stringify(b).slice(0, 140))
  return r.status
}
await put('docs/test.txt')
await put('.github/test.yml')
await put('.github/workflows/test.yml')
