// AssetFlix 冒烟测试:对运行中的实例跑一遍核心链路
// 用法:node scripts/smoke.mjs [BASE_URL]
const BASE = process.argv[2] || 'http://localhost:8080'
let cookie = ''
let failures = 0

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const sc = r.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]
  const j = await r.json().catch(() => null)
  return { status: r.status, body: j }
}

async function t(label, expect, method, path, body) {
  const r = await req(method, path, body)
  const ok = expect.includes(r.status)
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label} [${r.status}] ${JSON.stringify(r.body)?.slice(0, 200)}`)
  return r
}

const today = new Date().toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

console.log(`— AssetFlix smoke @ ${BASE} —`)
await t('bootstrap 未初始化', [200], 'GET', '/api/bootstrap')
await t('未登录访问受保护接口 401', [401], 'GET', '/api/accounts')
await t('setup 创建管理员', [200], 'POST', '/api/setup', { name: '家主', password: '1234' })
const me = await t('me 会话与等级', [200], 'GET', '/api/me')
console.log('  等级:', me.body?.level?.title, 'XP:', me.body?.level?.xp)

const a1 = await t('建账户·储蓄', [200], 'POST', '/api/accounts', { name: '招商储蓄', type: 'bank', currency: 'CNY' })
const a2 = await t('建账户·美股(USD)', [200], 'POST', '/api/accounts', { name: '美股券商', type: 'invest', currency: 'USD' })
const a3 = await t('建账户·房贷负债', [200], 'POST', '/api/accounts', { name: '房贷', type: 'liability', currency: 'CNY' })

const snap = await t('批量快照', [200], 'POST', '/api/snapshots/bulk', {
  date: today,
  entries: [
    { account_id: a1.body.id, value: 120000 },
    { account_id: a2.body.id, value: 8500 },
    { account_id: a3.body.id, value: 890000 },
  ],
})
console.log('  净资产(本位币):', snap.body?.totals?.net, '资产:', snap.body?.totals?.assets, '负债:', snap.body?.totals?.liabilities)

const c1 = await t('建信用卡(USD 年费)', [200], 'POST', '/api/cards', {
  bank: 'Chase', name: 'Sapphire', currency: 'USD', annual_fee: 95,
  fee_month: Number(plusDays(45).slice(5, 7)), fee_day: Number(plusDays(45).slice(8, 10)),
  waiver_type: 'count', waiver_count: 3,
})
await t('免年费进度 +1 笔', [200], 'POST', `/api/cards/${c1.body.id}/progress`, { add_count: 1 })
const b1 = await t('建权益·贵宾厅', [200], 'POST', '/api/benefits', {
  card_id: c1.body.id, name: '机场贵宾厅', type: 'count', total_count: 5, value: 200, currency: 'CNY', expire_date: plusDays(30),
})
await t('权益使用一次', [200], 'POST', `/api/benefits/${b1.body.id}/use`, {})
const b2 = await t('建权益·单次券', [200], 'POST', '/api/benefits', {
  card_id: c1.body.id, name: '视频会员月卡', type: 'count', total_count: 1, value: 25, currency: 'CNY', expire_date: plusDays(14),
})
await t('单次券使用', [200], 'POST', `/api/benefits/${b2.body.id}/use`, {})
await t('单次券超额使用被拒', [400], 'POST', `/api/benefits/${b2.body.id}/use`, {})

// 引擎:汇率/提醒/徽章/月报
await t('引擎执行', [200], 'POST', '/api/admin/engine-run')
const rem = await t('提醒列表(应有权益到期提醒)', [200], 'GET', '/api/reminders?status=pending')
console.log('  提醒数:', rem.body?.length, rem.body?.map((x) => x.source_type).join(','))
await t('月报列表', [200], 'GET', '/api/reports')
const bg = await t('徽章(应含 初次落笔)', [200], 'GET', '/api/badges')
console.log('  已解锁:', bg.body?.badges?.filter((b) => b.earned_at).map((b) => b.name).join(' / '))
const nw = await t('净资产曲线', [200], 'GET', '/api/networth?days=30')
console.log('  曲线点数:', nw.body?.series?.length, '最新净值:', nw.body?.series?.at(-1)?.net)

// CSV 导入
await t('CSV 导入', [200], 'POST', '/api/import/snapshots', { date: today, csv: '支付宝现金,8888,CNY,cash\n港股,12000,HKD,invest' })

// 多成员隔离
await t('管理员添加成员', [200], 'POST', '/api/admin/members', { name: '另一半', emoji: '🦊', color: '#0071EB' })
await req('DELETE', '/api/session'); cookie = ''
const boot2 = await t('bootstrap 显示两位成员', [200], 'GET', '/api/bootstrap')
console.log('  成员:', boot2.body?.members?.map((m) => m.name).join(' / '))
const m2 = boot2.body?.members?.find((m) => m.name === '另一半')
await t('成员2 登录', [200], 'POST', '/api/session', { member_id: m2.id })
const iso = await t('成员2 看不到成员1 的账户(隔离)', [200], 'GET', '/api/accounts')
if (iso.body?.length !== 0) { failures++; console.log('✗ 隔离失败,成员2 看到了数据!') }
else console.log('✓ 数据隔离验证通过')
await t('成员2 访问管理接口 403', [403], 'GET', '/api/admin/members')

console.log(failures === 0 ? '— 全部通过 —' : `— ${failures} 项失败 —`)
process.exit(failures === 0 ? 0 : 1)
