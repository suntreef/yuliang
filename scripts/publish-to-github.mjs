// 余粮 · 一键在线发布:创建 GitHub 仓库 → 上传源码 → 触发 Actions 构建镜像 → 等待发布完成
// 用法:node scripts/publish-to-github.mjs [REPO_NAME]
// token 从项目根目录 .token 读取(设备授权脚本产出);构建与镜像发布由 GitHub Actions 云端完成。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = fs.readFileSync(path.join(ROOT, '.token'), 'utf8').trim()
const REPO = process.argv[2] || 'yuliang'
const SKIP = new Set(['node_modules', 'dist', 'data', '.git', '.smoke-data', '.regress-data', '.tools', '.token'])
const SKIP_FILE = /\.(log|zip|db|db-shm|db-wal)$/i
const API = 'https://api.github.com'

// 网络重试:仅对连接层错误重试(4xx/5xx 原样抛出)
const gh = async (method, url, body) => {
  let res
  for (let i = 0; i < 5; i++) {
    try {
      res = await fetch(API + url, {
        method,
        headers: {
          authorization: `Bearer ${TOKEN}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': 'yuliang-publisher',
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      break
    } catch (e) {
      if (i === 4) throw e
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${await res.text().catch(() => '')}`)
  return res.status === 204 ? null : res.json()
}

const user = await gh('GET', '/user')
const OWNER = user.login
console.log(`✔ GitHub 账号:${OWNER}`)

let repo
try {
  repo = await gh('POST', '/user/repos', { name: REPO, description: '余粮 YULIANG · 家有余粮,心里不慌(Docker 自托管多人资产看板)', private: false, auto_init: false })
  console.log(`✔ 已创建仓库:${repo.full_name}`)
} catch (e) {
  if (String(e).includes('422')) { console.log(`✔ 仓库 ${OWNER}/${REPO} 已存在,直接复用`); repo = { full_name: `${OWNER}/${REPO}` } }
  else throw e
}

// 收集文件(相对路径 → base64)
const files = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (!SKIP_FILE.test(name)) files.push(path.relative(ROOT, p).split(path.sep).join('/'))
  }
}
walk(ROOT)
console.log(`共 ${files.length} 个源文件待上传`)

// 上传用 Contents API(workflow scope 已授权,可写 .github/workflows/)。
// workflow 文件排到最后:此前无 workflow 文件不触发构建,最后一个提交 = 全量文件 → 恰好触发一次完整构建。
const ordered = [
  ...files.filter((f) => !f.startsWith('.github/workflows/')),
  ...files.filter((f) => f.startsWith('.github/workflows/')),
]
for (const rel of ordered) {
  const enc = rel.split('/').map(encodeURIComponent).join('/') // 逐段编码:中文文件名可用,斜杠保留
  const content = fs.readFileSync(path.join(ROOT, rel)).toString('base64')
  let sha
  try { sha = (await gh('GET', `/repos/${repo.full_name}/contents/${enc}?ref=main`)).sha } catch { /* 新文件 */ }
  await gh('PUT', `/repos/${repo.full_name}/contents/${enc}`, {
    message: `feat: ${rel}`,
    content, sha, branch: 'main',
  })
  console.log(`  ↑ ${rel}`)
}
// 清理探针残留文件
for (const p of ['docs/test.txt', '.github/test.yml']) {
  try {
    const f = await gh('GET', `/repos/${repo.full_name}/contents/${p}?ref=main`)
    await gh('DELETE', `/repos/${repo.full_name}/contents/${p}`, { message: `chore: remove ${p}`, sha: f.sha, branch: 'main' })
    console.log(`  ↓ ${p}(清理探针残留)`)
  } catch { /* 不存在 */ }
}

console.log('\n⏳ Actions 构建中(amd64+arm64 双架构,首次约 3~6 分钟)…')
let run
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10000))
  const runs = await gh('GET', `/repos/${repo.full_name}/actions/runs?per_page=1`)
  run = runs.workflow_runs[0]
  if (run && run.status === 'completed') break
  process.stdout.write(`  … ${run ? run.status : '等待触发'}\r`)
}
console.log(`\n${run.conclusion === 'success' ? '✔ 镜像发布成功' : `✗ 构建未成功(${run.conclusion}),到 ${repo.html_url}/actions 查看日志`}`)

if (run.conclusion === 'success') {
  const image = `ghcr.io/${OWNER}/${REPO}`.toLowerCase()
  console.log(`
──────────────────────────────────────────────
镜像地址:${image}:latest(以及 sha- 短标签)
首次发布需要做一件事:把镜像包设为公开
  → 打开 https://github.com/${OWNER}?tab=packages → 点 yuliang → Package settings → Change visibility → Public
(或者 NAS 上 docker login ghcr.io 用同一个 token,二选一)

NAS 上部署(以后每次更新都一样):
  mkdir yuliang && cd yuliang
  # 下载仓库里的 docker-compose.yml,把 OWNER 换成 ${OWNER}
  docker compose pull && docker compose up -d
──────────────────────────────────────────────`)
}
