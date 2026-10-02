import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { Modal, Field, Btn, inputCls, Empty } from '../ui'

const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD']
const THRESHOLDS = [1, 3, 7, 14, 30]
const EMOJIS = ['🎬', '🍿', '🦊', '🐱', '🐶', '🚀', '🌙', '☕️', '🎧', '🦁', '🐼', '🍀']
const COLORS = ['#E50914', '#0071EB', '#F5B50A', '#2BB673', '#8B5CF6', '#FF6B35', '#00A8A8', '#D63384']

export default function Settings() {
  const { me, refresh } = useApp()
  const [mst, setMst] = useState<any>(null)
  const [gst, setGst] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [addMember, setAddMember] = useState(false)

  const load = useCallback(() => {
    api.get('/api/settings/member').then(setMst).catch(() => {})
    if (me.member.isAdmin) {
      api.get('/api/settings/global').then(setGst).catch(() => {})
      api.get('/api/admin/members').then(setMembers).catch(() => {})
    }
  }, [me])
  useEffect(() => { load() }, [load])

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  return (
    <div className="px-4 md:px-10 py-6 max-w-3xl" data-testid="settings-page">
      <h1 className="text-xl md:text-2xl font-black mb-6">设置</h1>
      {msg && <div className="mb-4 bg-emerald-900/60 border border-emerald-600/40 text-emerald-300 text-sm px-4 py-2 rounded">{msg}</div>}

      <ProfileCard onFlash={flash} onChanged={refresh} />
      <div className="h-6" />
      <ReminderCard2 st={mst} onSaved={(s: any) => { setMst(s); flash('提醒设置已保存') }} />

      {me.member.isAdmin && (
        <>
          <div className="h-6" />
          <GlobalCard gst={gst} onSaved={(g: any) => { setGst(g); flash('全局设置已保存') }} onFlash={flash} />

          <div className="h-6" />
          <div className="bg-nfx-card rounded-lg p-5">
            <div className="flex items-center mb-3">
              <h3 className="font-bold">成员管理</h3>
              <Btn ghost className="ml-auto !py-1.5" onClick={() => setAddMember(true)}>+ 添加成员</Btn>
            </div>
            <div className="divide-y divide-white/5">
              {members.map((m: any) => <MemberRow key={m.id} m={m} onChanged={load} onFlash={flash} />)}
            </div>
          </div>

          <div className="h-6" />
          <div className="bg-nfx-card rounded-lg p-5">
            <h3 className="font-bold mb-3">数据与运维</h3>
            <div className="flex flex-wrap gap-2">
              <Btn ghost onClick={async () => {
                const r = await fetch('/api/admin/export')
                const blob = await r.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'assetflix-backup.json'
                a.click()
                flash('备份已导出(含全部成员,请妥善保管)')
              }}>导出全量备份</Btn>
              <Btn ghost onClick={async () => { const r = await api.post('/api/admin/fx-refresh'); flash(r.ok ? '汇率已更新' : '汇率源不可达,请检查网络或用手动汇率') }}>立即抓取汇率</Btn>
              <Btn ghost onClick={async () => { await api.post('/api/admin/engine-run'); flash('引擎已执行:提醒/月报/徽章已刷新') }}>立即跑一次引擎</Btn>
            </div>
            <div className="text-xs text-gray-500 mt-3">备份文件包含所有成员数据,由管理员保管;数据库文件位于 volume 的 data/assetflix.db。</div>
          </div>
        </>
      )}

      <Modal open={addMember} onClose={() => setAddMember(false)} title="添加成员">
        <MemberForm onSaved={() => { setAddMember(false); load(); flash('成员已添加') }} />
      </Modal>
    </div>
  )
}

// ---------- 我的资料 ----------
function ProfileCard({ onFlash, onChanged }: any) {
  const { me } = useApp()
  const [f, setF] = useState<any>(null)
  useEffect(() => {
    if (me) setF({ name: me.member.name, emoji: me.member.emoji, color: me.member.color, password: '' })
  }, [me])
  if (!f) return null
  const save = async () => {
    const body: any = { name: f.name, emoji: f.emoji, color: f.color }
    if (f.password) body.password = f.password
    await api.put('/api/me/profile', body)
    onFlash('资料已保存')
    onChanged()
  }
  return (
    <div className="bg-nfx-card rounded-lg p-5">
      <h3 className="font-bold mb-3">我的资料</h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-xl grid place-items-center text-3xl" style={{ background: f.color }}>{f.emoji}</div>
        <div className="flex-1"><Field label="名字"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
      </div>
      <Field label="头像">
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setF({ ...f, emoji: e })}
              className={`w-9 h-9 rounded-lg grid place-items-center text-lg ${f.emoji === e ? 'bg-nfx-red' : 'bg-white/10 hover:bg-white/20'}`}>{e}</button>
          ))}
        </div>
      </Field>
      <Field label="头像底色">
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setF({ ...f, color: c })}
              className={`w-8 h-8 rounded-lg ${f.color === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </Field>
      <Field label={`密码${me.member.hasPassword ? '(留空表示不修改)' : '(当前未设置)'}`}>
        <input className={inputCls} type="password" value={f.password} placeholder="至少 4 位"
          onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      {me.member.hasPassword && (
        <button className="text-xs text-gray-400 hover:text-nfx-red underline mb-3"
          onClick={async () => { await api.put('/api/me/profile', { password: null }); onFlash('密码已清除,该档案可免密进入'); onChanged() }}>
          清除密码(允许免密进入该档案)
        </button>
      )}
      <Btn onClick={save}>保存资料</Btn>
    </div>
  )
}

// ---------- 提醒设置 ----------
function ReminderCard2({ st, onSaved }: any) {
  const [f, setF] = useState<any>(null)
  useEffect(() => { if (st) setF(JSON.parse(JSON.stringify(st))) }, [st])
  if (!f) return null
  const toggleTh = (n: number) => {
    const has = f.thresholds.includes(n)
    setF({ ...f, thresholds: has ? f.thresholds.filter((x: number) => x !== n) : [...f.thresholds, n] })
  }
  const addChannel = (type: string) => {
    setF({ ...f, channels: [...f.channels, type === 'webhook' ? { type: 'webhook', url: '' } : { type: 'email', to: '' }] })
  }
  const setCh = (i: number, k: string, v: string) => {
    const channels = f.channels.map((c: any, j: number) => (j === i ? { ...c, [k]: v } : c))
    setF({ ...f, channels })
  }
  const save = async () => { onSaved(await api.put('/api/settings/member', f)) }
  return (
    <div className="bg-nfx-card rounded-lg p-5">
      <h3 className="font-bold mb-3">提醒设置</h3>
      <Field label="提前提醒天数(年费与权益到期)">
        <div className="flex gap-1.5 flex-wrap">
          {THRESHOLDS.map((n) => (
            <button key={n} onClick={() => toggleTh(n)}
              className={`px-3 py-1.5 rounded-full text-xs ${f.thresholds.includes(n) ? 'bg-nfx-red font-bold' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
              提前 {n} 天
            </button>
          ))}
        </div>
      </Field>
      <Field label="推送方式">
        <select className={inputCls} value={f.digest_hour ?? ''} onChange={(e) => setF({ ...f, digest_hour: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">立即推送(每条单独发)</option>
          <option value="8">每日摘要 · 早上 8 点合并推送</option>
          <option value="12">每日摘要 · 中午 12 点</option>
          <option value="20">每日摘要 · 晚上 8 点</option>
        </select>
      </Field>
      <Field label="通知渠道(Webhook / Email,可多个)">
        <div className="space-y-2">
          {f.channels.map((c: any, i: number) => (
            <div key={i} className="flex gap-2">
              <span className="text-xs text-gray-400 w-16 leading-loose">{c.type === 'webhook' ? 'Webhook' : 'Email'}</span>
              <input className={inputCls} value={c.url || c.to}
                placeholder={c.type === 'webhook' ? 'https://…(POST JSON)' : 'you@example.com'}
                onChange={(e) => setCh(i, c.type === 'webhook' ? 'url' : 'to', e.target.value)} />
              <button className="text-xs text-gray-400 hover:text-nfx-red px-2"
                onClick={() => setF({ ...f, channels: f.channels.filter((_: any, j: number) => j !== i) })}>删除</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button className="text-xs underline text-gray-300 hover:text-white" onClick={() => addChannel('webhook')}>+ Webhook</button>
          <button className="text-xs underline text-gray-300 hover:text-white" onClick={() => addChannel('email')}>+ Email(需管理员先配 SMTP)</button>
        </div>
      </Field>
      <div className="text-xs text-gray-500 mb-3">Webhook 会收到 POST JSON:{`{ app, member, source, level, title, body, due_date }`},可对接 ntfy / Server酱 / 企业微信 / 钉钉 / 飞书机器人。</div>
      <Btn onClick={save}>保存提醒设置</Btn>
    </div>
  )
}

// ---------- 全局(管理员) ----------
function GlobalCard({ gst, onSaved, onFlash }: any) {
  const [f, setF] = useState<any>(null)
  const [fxKey, setFxKey] = useState('')
  const [fxVal, setFxVal] = useState('')
  useEffect(() => { if (gst) setF(JSON.parse(JSON.stringify(gst))) }, [gst])
  if (!f) return null
  const save = async () => {
    await api.put('/api/settings/global', {
      base_currency: f.base_currency, quick_entry: f.quick_entry, fx_manual: f.fx_manual, smtp: f.smtp,
    })
    onSaved(await api.get('/api/settings/global'))
  }
  return (
    <div className="bg-nfx-card rounded-lg p-5">
      <h3 className="font-bold mb-1">全局设置 <span className="text-[10px] bg-nfx-red px-1.5 py-0.5 rounded align-middle">管理员</span></h3>
      <div className="text-xs text-gray-500 mb-3">上次汇率抓取:{f.fx_last_fetch ? `${f.fx_last_fetch.date}${f.fx_last_fetch.ok ? '(成功)' : '(失败,用手动/旧值)'}` : '从未'}</div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="本位币(报表折算基准)">
          <select className={inputCls} value={f.base_currency} onChange={(e) => setF({ ...f, base_currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="免密快速进入(点头像直接进入档案)">
          <button onClick={() => setF({ ...f, quick_entry: !f.quick_entry })}
            className={`w-full text-sm py-2 rounded font-bold ${f.quick_entry ? 'bg-nfx-red' : 'bg-white/10 text-gray-400'}`}>
            {f.quick_entry ? '已开启' : '已关闭(需密码)'}
          </button>
        </Field>
      </div>

      <Field label="手动汇率(优先于自动抓取,1 外币 = ? 本位币)">
        <div className="space-y-1.5">
          {Object.entries(f.fx_manual || {}).map(([k, v]: any) => (
            <div key={k} className="flex gap-2 items-center">
              <span className="text-xs w-10 text-gray-300">{k}</span>
              <input className={inputCls + ' !w-32'} type="number" step="any" value={v}
                onChange={(e) => setF({ ...f, fx_manual: { ...f.fx_manual, [k]: e.target.value } })} />
              <button className="text-xs text-gray-400 hover:text-nfx-red"
                onClick={() => { const m = { ...f.fx_manual }; delete m[k]; setF({ ...f, fx_manual: m }) }}>删除</button>
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <input className={inputCls + ' !w-20'} placeholder="币种" value={fxKey} onChange={(e) => setFxKey(e.target.value.toUpperCase())} />
            <input className={inputCls + ' !w-32'} type="number" step="any" placeholder="汇率" value={fxVal} onChange={(e) => setFxVal(e.target.value)} />
            <button className="text-xs underline text-gray-300 hover:text-white"
              onClick={() => { if (/^[A-Z]{3}$/.test(fxKey) && Number(fxVal) > 0) { setF({ ...f, fx_manual: { ...f.fx_manual, [fxKey]: fxVal } }); setFxKey(''); setFxVal('') } }}>添加</button>
          </div>
        </div>
      </Field>

      <Field label="SMTP 邮件(用于 Email 渠道)">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="SMTP 服务器" value={f.smtp?.host || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), host: e.target.value } })} />
          <input className={inputCls} placeholder="端口(如 465)" value={f.smtp?.port || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), port: e.target.value } })} />
          <input className={inputCls} placeholder="账号" value={f.smtp?.user || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), user: e.target.value } })} />
          <input className={inputCls} type="password" placeholder={gst?.hasSmtpPass ? '已保存,留空不改' : '密码/授权码'} value={f.smtp?.pass || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), pass: e.target.value } })} />
          <input className={inputCls} placeholder="发件人(可选)" value={f.smtp?.from || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), from: e.target.value } })} />
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={!!f.smtp?.secure} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), secure: e.target.checked } })} />SSL(465 端口勾选)</label>
        </div>
      </Field>

      <Btn onClick={save}>保存全局设置</Btn>
    </div>
  )
}

function MemberRow({ m, onChanged, onFlash }: any) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="w-9 h-9 rounded-md grid place-items-center text-lg" style={{ background: m.color }}>{m.emoji}</span>
      <div>
        <div className="text-sm font-bold">{m.name} {m.isAdmin ? <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded ml-1">管理员</span> : null}</div>
        <div className="text-xs text-gray-500">{m.active ? '使用中' : '已停用'} · {m.hasPassword ? '有密码' : '免密'}</div>
      </div>
      <div className="ml-auto flex gap-2">
        <button className="text-xs underline text-gray-300 hover:text-white" onClick={() => setEditing(true)}>编辑</button>
        {!m.isAdmin && (
          <button className="text-xs underline text-gray-400 hover:text-nfx-red"
            onClick={async () => { await api.put(`/api/admin/members/${m.id}`, { active: m.active ? false : true }); onChanged() }}>
            {m.active ? '停用' : '启用'}
          </button>
        )}
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title={`编辑成员:${m.name}`}>
        <MemberForm member={m} onSaved={() => { setEditing(false); onChanged(); onFlash('成员已更新') }} />
      </Modal>
    </div>
  )
}

function MemberForm({ member, onSaved }: any) {
  const [f, setF] = useState<any>(member ? { name: member.name, emoji: member.emoji, color: member.color, password: '', isAdmin: member.isAdmin } : { name: '', emoji: '🍿', color: '#0071EB', password: '', isAdmin: false })
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    try {
      const body: any = { name: f.name, emoji: f.emoji, color: f.color }
      if (f.password) body.password = f.password
      if (member) await api.put(`/api/admin/members/${member.id}`, body)
      else await api.post('/api/admin/members', { ...body, is_admin: f.isAdmin ? 1 : 0 })
      onSaved()
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <Field label="名字"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="头像">
        <div className="flex flex-wrap gap-1.5">
          {['🎬', '🍿', '🦊', '🐱', '🐶', '🚀', '🌙', '☕️', '🎧', '🦁', '🐼', '🍀'].map((e) => (
            <button key={e} onClick={() => setF({ ...f, emoji: e })} className={`w-9 h-9 rounded-lg grid place-items-center text-lg ${f.emoji === e ? 'bg-nfx-red' : 'bg-white/10 hover:bg-white/20'}`}>{e}</button>
          ))}
        </div>
      </Field>
      <Field label="头像底色">
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} className={`w-8 h-8 rounded-lg ${f.color === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} />)}
        </div>
      </Field>
      <Field label={member ? '重置密码(留空不改)' : '密码(可选)'}>
        <input className={inputCls} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="至少 4 位" />
      </Field>
      {!member && (
        <label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
          <input type="checkbox" checked={f.isAdmin} onChange={(e) => setF({ ...f, isAdmin: e.target.checked })} />设为管理员
        </label>
      )}
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      <Btn onClick={save}>{member ? '保存' : '创建成员'}</Btn>
    </div>
  )
}
