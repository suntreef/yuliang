// GitHub 设备授权:无需手动建 token,浏览器里点一次授权即可
// 产出:.token 文件(仅存本机,不入仓库)。可随时在 GitHub → Settings → Applications 撤销。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CLIENT_ID = '178c6fc778ccc68e1d6a' // GitHub CLI 官方公开 client_id(开源项目)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// 网络重试:国内连 GitHub 时好时坏,超时/断连自动重试
const fetchRetry = async (url, opts, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, opts)
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
}

let init
for (let i = 0; i < 6; i++) {
  try {
    init = await (await fetchRetry('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: 'repo workflow' }),
    })).json()
    if (init.user_code) break
  } catch (e) { console.log(`(网络抖动,重试 ${i + 1}/6)`) }
  await new Promise((r) => setTimeout(r, 3000))
}
if (!init?.user_code) { console.error('无法连接 github.com,请检查网络/代理后重试'); process.exit(1) }

console.log('USER_CODE:' + init.user_code)
console.log('URL:' + init.verification_uri)
console.log('INTERVAL:' + (init.interval || 5))
console.log('EXPIRES_IN:' + init.expires_in)

const interval = (init.interval || 5) * 1000
const deadline = Date.now() + (init.expires_in || 900) * 1000
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, interval))
  let t
  try {
    t = await (await fetchRetry('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: init.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    })).json()
  } catch { process.stdout.write('×(网络抖动)\r'); continue }
  if (t.access_token) {
    fs.writeFileSync(path.join(ROOT, '.token'), t.access_token)
    console.log('TOKEN_SAVED')
    process.exit(0)
  }
  if (t.error === 'authorization_pending') { process.stdout.write('…等待授权\r'); continue }
  if (t.error === 'slow_down') { await new Promise((r) => setTimeout(r, 5000)); continue }
  console.error('授权失败:' + t.error)
  process.exit(1)
}
console.error('授权码已过期,请重试')
process.exit(1)
