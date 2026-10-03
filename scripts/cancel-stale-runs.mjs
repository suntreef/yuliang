// 取消旧 head 上的构建,保证 :latest 指向最终提交
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = fs.readFileSync(path.join(ROOT, '.token'), 'utf8').trim()
const H = { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'yuliang-ops' }

const runs = await fetch('https://api.github.com/repos/suntreef/yuliang/actions/runs?per_page=10', { headers: H }).then((r) => r.json())
for (const r of runs.workflow_runs || []) {
  if (r.status === 'in_progress' || r.status === 'queued') {
    const c = await fetch(`https://api.github.com/repos/suntreef/yuliang/actions/runs/${r.id}/cancel`, { method: 'POST', headers: H })
    console.log(`取消 run ${r.id}(head ${r.head_sha.slice(0, 7)},${r.status})→ ${c.status}`)
  } else {
    console.log(`run ${r.id}(head ${r.head_sha.slice(0, 7)},${r.conclusion})保留`)
  }
}
