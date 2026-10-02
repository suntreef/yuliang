import React, { useCallback, useEffect, useState } from 'react'
import { api, fmtCompact, todayStr } from '../api'
import { Modal, Field, Btn, inputCls, ProgressBar, Sparkline, Empty } from '../ui'

const TYPE_META: any = {
  cash: ['🪙', '现金'], bank: ['🏦', '储蓄理财'], invest: ['📈', '投资'],
  pension: ['🧧', '公积金'], points: ['🎁', '积分里程'], liability: ['🏠', '负债'],
}
const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD']
const RANGES = [['30', '近1月'], ['90', '近3月'], ['365', '近1年'], ['3650', '全部']] as const

export default function Assets() {
  const [net, setNet] = useState<any>(null)
  const [days, setDays] = useState('365')
  const [accounts, setAccounts] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])

  const [snapOpen, setSnapOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [editAcc, setEditAcc] = useState<any>(null)

  const load = useCallback(() => {
    api.get(`/api/networth?days=${days}`).then(setNet).catch(() => {})
    api.get('/api/accounts').then(setAccounts).catch(() => {})
    api.get('/api/goals').then(setGoals).catch(() => {})
  }, [days])
  useEffect(() => { load() }, [load])

  const active = accounts.filter((a) => !a.archived)
  const grouped: any = {}
  for (const a of active) (grouped[a.type] = grouped[a.type] || []).push(a)

  return (
    <div className="px-4 md:px-10 py-6" data-testid="assets-page">
      <div className="flex items-center flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-black">资产档案</h1>
        <div className="ml-auto flex gap-2">
          <Btn ghost onClick={() => setImportOpen(true)}>导入 CSV</Btn>
          <Btn onClick={() => setSnapOpen(true)}>记录快照 +10XP</Btn>
        </div>
      </div>

      {/* 曲线 */}
      <div className="mt-5 bg-nfx-card rounded-lg p-4 md:p-6">
        <div className="flex gap-1.5 mb-2">
          {RANGES.map(([v, label]) => (
            <button key={v} onClick={() => setDays(v)}
              className={`text-xs px-3 py-1.5 rounded-full ${days === v ? 'bg-nfx-red font-bold' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>{label}</button>
          ))}
        </div>
        {net && <Sparkline series={net.series} />}
        {net && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="净资产" value={fmtCompact(net.totals.net, net.base)} big />
            <Stat label="资产" value={fmtCompact(net.totals.assets, net.base)} />
            <Stat label="负债" value={fmtCompact(net.totals.liabilities, net.base)} warn />
          </div>
        )}
      </div>

      {/* 账户 */}
      <div className="mt-8">
        <div className="flex items-center mb-3">
          <h2 className="text-lg font-bold">账户({active.length})</h2>
          <button className="ml-auto text-sm text-gray-300 hover:text-white underline" onClick={() => { setEditAcc(null); setAccOpen(true) }}>+ 添加账户</button>
        </div>
        {!active.length && <Empty icon="💼" text="还没有账户,点右上角添加,或用 CSV 导入" />}
        {Object.entries(grouped).map(([type, list]: any) => (
          <div key={type} className="mb-5">
            <div className="text-xs text-gray-400 mb-2">{TYPE_META[type]?.[1] || type}</div>
            <div className="bg-nfx-card rounded-lg divide-y divide-white/5">
              {list.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl">{TYPE_META[a.type]?.[0] || '💼'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.institution || ''} {a.latest_date || '未记录'}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className={`text-sm font-bold ${a.type === 'liability' ? 'text-orange-400' : ''}`}>{a.latest_value != null ? fmtCompact(a.latest_value, a.currency) : '—'}</div>
                    <div className="text-[10px] text-gray-500">{a.currency}</div>
                  </div>
                  <button className="text-xs text-gray-400 hover:text-white underline" onClick={() => { setEditAcc(a); setAccOpen(true) }}>编辑</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 目标 */}
      <div className="mt-8">
        <div className="flex items-center mb-3">
          <h2 className="text-lg font-bold">正在追的目标</h2>
          <button className="ml-auto text-sm text-gray-300 hover:text-white underline" onClick={() => setGoalOpen(true)}>+ 新目标</button>
        </div>
        {!goals.length && <Empty icon="🎯" text="立一个目标,首页就会出现「正在追」一排" />}
        <div className="grid sm:grid-cols-2 gap-3">
          {goals.map((g) => {
            const pct = Math.min(100, ((g.current_amount || 0) / g.target_amount) * 100)
            return (
              <div key={g.id} className="bg-nfx-card rounded-lg p-4 flex items-center gap-3">
                <div className="text-2xl">🎯</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold flex items-center gap-2">{g.name} {g.done ? <span className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded">达成</span> : null}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{fmtCompact(g.current_amount, g.currency)} / {fmtCompact(g.target_amount, g.currency)} {g.due_date ? `· 截止 ${g.due_date}` : ''}</div>
                  <ProgressBar pct={pct} className="mt-2" />
                </div>
                <button className="text-xs text-gray-400 hover:text-nfx-red" onClick={async () => { await api.del(`/api/goals/${g.id}`); load() }}>删除</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------- 弹层 ---------- */}
      <SnapshotModal open={snapOpen} accounts={active} onClose={() => setSnapOpen(false)} onSaved={() => { setSnapOpen(false); load() }} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={() => { setImportOpen(false); load() }} />
      <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} onSaved={() => { setGoalOpen(false); load() }} />
      <AccountModal open={accOpen} account={editAcc} onClose={() => setAccOpen(false)} onSaved={() => { setAccOpen(false); load() }} />
    </div>
  )
}

function Stat({ label, value, big, warn }: any) {
  return (
    <div className={`rounded-lg p-3 ${big ? 'bg-white/5' : 'bg-black/20'}`}>
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className={`${big ? 'text-xl md:text-2xl' : 'text-base md:text-lg'} font-black mt-1 ${warn ? 'text-orange-400' : ''}`}>{value}</div>
    </div>
  )
}

function SnapshotModal({ open, accounts, onClose, onSaved }: any) {
  const [date, setDate] = useState(todayStr())
  const [values, setValues] = useState<any>({})
  const [prefill, setPrefill] = useState<any>({})
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(todayStr())
    api.get('/api/snapshots/latest').then((r) => {
      const map: any = {}
      for (const e of r.entries) map[e.account_id] = String(e.value)
      setPrefill(map)
      setValues(map)
    }).catch(() => setValues({}))
  }, [open])

  const save = async () => {
    setErr('')
    const entries = accounts
      .filter((a: any) => values[a.id] !== undefined && values[a.id] !== '' && Number.isFinite(Number(values[a.id])))
      .map((a: any) => ({ account_id: a.id, value: Number(values[a.id]) }))
    if (!entries.length) { setErr('至少填写一个账户余额'); return }
    try {
      await api.post('/api/snapshots/bulk', { date, entries })
      onSaved()
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title="记录资产快照" wide>
      <Field label="快照日期"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="text-xs text-gray-400 mb-2">填写各账户当前余额(同日重复保存会覆盖,不影响 XP)。</div>
      {!accounts.length && <Empty icon="💼" text="还没有账户,先去添加账户或用 CSV 导入" />}
      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
        {accounts.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3">
            <div className="w-28 sm:w-40 shrink-0 text-sm truncate">{TYPE_META[a.type]?.[0]} {a.name}</div>
            <span className="text-[10px] text-gray-500 w-8">{a.currency}</span>
            <input className={inputCls} type="number" step="any" placeholder={String(prefill[a.id] ?? '')}
              value={values[a.id] ?? ''} onChange={(e) => setValues({ ...values, [a.id]: e.target.value })} />
          </div>
        ))}
      </div>
      {err && <div className="text-nfx-red text-sm mt-3">{err}</div>}
      <div className="mt-4"><Btn className="w-full py-3" onClick={save}>保存快照</Btn></div>
    </Modal>
  )
}

function ImportModal({ open, onClose, onSaved }: any) {
  const [date, setDate] = useState(todayStr())
  const [csv, setCsv] = useState('')
  const [msg, setMsg] = useState<any>(null)
  const [err, setErr] = useState('')
  const save = async () => {
    setErr(''); setMsg(null)
    try {
      const r = await api.post('/api/import/snapshots', { date, csv })
      setMsg(r)
      setTimeout(onSaved, 1200)
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="CSV 导入快照" wide>
      <Field label="快照日期"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="CSV 内容(每行:账户名,余额,币种(可选),类型(可选))">
        <textarea className={inputCls + ' font-mono text-xs h-40'} value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder={'招商储蓄,120000,CNY,bank\n美股券商,8500,USD,invest\n房贷,890000,CNY,liability'} />
      </Field>
      <div className="text-xs text-gray-500 mb-3">类型支持:cash 现金 / bank 储蓄 / invest 投资 / pension 公积金 / points 积分 / liability 负债。不存在的账户会自动创建。</div>
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      {msg && <div className="text-emerald-400 text-sm mb-2">已导入 {msg.imported} 条,新建账户 {msg.createdAccounts} 个。</div>}
      <Btn className="w-full py-3" onClick={save}>导入</Btn>
    </Modal>
  )
}

function GoalModal({ open, onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ name: '', kind: 'networth', target_amount: '', current_amount: '', currency: 'CNY', due_date: '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try { await api.post('/api/goals', f); setF({ name: '', kind: 'networth', target_amount: '', current_amount: '', currency: 'CNY', due_date: '' }); onSaved() }
    catch (e: any) { setErr(e.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="新目标">
      <Field label="目标名"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="如 净资产 50 万" /></Field>
      <Field label="类型">
        <select className={inputCls} value={f.kind} onChange={set('kind')}>
          <option value="networth">跟随净资产(自动更新进度)</option>
          <option value="manual">手动更新进度</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="目标金额"><input className={inputCls} type="number" value={f.target_amount} onChange={set('target_amount')} /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {f.kind === 'manual' && <Field label="当前金额"><input className={inputCls} type="number" value={f.current_amount} onChange={set('current_amount')} /></Field>}
        <Field label="截止日期(可选)"><input className={inputCls} type="date" value={f.due_date} onChange={set('due_date')} /></Field>
      </div>
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      <Btn className="w-full py-3" onClick={save}>立目标</Btn>
    </Modal>
  )
}

function AccountModal({ open, account, onClose, onSaved }: any) {
  const [f, setF] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (open) setF(account ? { ...account } : { name: '', type: 'bank', currency: 'CNY', institution: '' })
  }, [open, account])
  if (!f) return null
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try {
      if (account) await api.put(`/api/accounts/${account.id}`, f)
      else await api.post('/api/accounts', f)
      onSaved()
    } catch (e: any) { setErr(e.message) }
  }
  const archive = async () => {
    await api.del(`/api/accounts/${account.id}`)
    onSaved()
  }
  return (
    <Modal open={open} onClose={onClose} title={account ? '编辑账户' : '添加账户'}>
      <Field label="账户名"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="如 招商储蓄" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="类型">
          <select className={inputCls} value={f.type} onChange={set('type')}>
            {Object.entries(TYPE_META).map(([k, v]: any) => <option key={k} value={k}>{v[1]}</option>)}
          </select>
        </Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="机构(可选)"><input className={inputCls} value={f.institution || ''} onChange={set('institution')} /></Field>
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      <div className="flex gap-2">
        <Btn onClick={save}>保存</Btn>
        <Btn ghost onClick={onClose}>取消</Btn>
        {account && <Btn ghost className="ml-auto !bg-white/5 text-gray-400" onClick={archive}>归档</Btn>}
      </div>
    </Modal>
  )
}
