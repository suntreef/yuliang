// 对账:仓库真实文件树 + Actions 运行状态 vs 本地磁盘
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = fs.readFileSync(path.join(ROOT, '.token'), 'utf8').trim()
const H = { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'yuliang-verify' }

const repo = await fetch('https://api.github.com/repos/suntreef/yuliang', { headers: H }).then((r) => r.json())
console.log('仓库:', repo.full_name || JSON.stringify(repo), '| private:', repo.private, '| default:', repo.default_branch)

const tree = await fetch('https://api.github.com/repos/suntreef/yuliang/git/trees/main?recursive=1', { headers: H }).then((r) => r.json())
const remote = (tree.tree || []).filter((t) => t.type === 'blob').map((t) => t.path)
console.log(`\n仓库文件(${remote.length}):`)
console.log('  ' + remote.join('\n  '))

const SKIP = new Set(['node_modules', 'dist', 'data', '.git', '.smoke-data', '.regress-data', '.tools', '.token'])
const SKIP_FILE = /\.(log|zip|db|db-shm|db-wal)$/i
const local = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (!SKIP_FILE.test(name)) local.push(path.relative(ROOT, p).split(path.sep).join('/'))
  }
}
walk(ROOT)
const missing = local.filter((f) => !remote.includes(f))
const extra = remote.filter((f) => !local.includes(f))
console.log(`\n本地有而仓库缺(${missing.length}):`, missing.join(', ') || '无')
console.log(`仓库有而本地无(${extra.length}):`, extra.join(', ') || '无')

const runs = await fetch('https://api.github.com/repos/suntreef/yuliang/actions/runs?per_page=5', { headers: H }).then((r) => r.json())
console.log('\nActions 运行:')
for (const r of runs.workflow_runs || []) {
  console.log(`  ${r.created_at} | ${r.name} | ${r.status} | ${r.conclusion} | head:${r.head_sha.slice(0, 7)}`)
}
