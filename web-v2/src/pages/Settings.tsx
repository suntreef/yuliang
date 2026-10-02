import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useApp } from '../App'
import { Sheet, Field, Btn, inputCls, Chip } from '../ui'

const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD']
const THRESHOLDS = [1, 3, 7, 14, 30]
const EMOJIS = ['🎬', '🍿', '🦊', '🐱', '🐶', '🚀', '🌙', '☕️', '🎧', '🦁', '🐼', '🍀']
const COLORS = ['#0D9488', '#0284C7', '#F59E0B', '#F43F5E', '#8B5CF6', '#059669', '#6366F1', '#D63384']

export default function Settings() {
  const { me, refresh, logout } = useApp()
  const nav = useNavigate()
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
    <div data-testid="settings-page">
      <div className="flex items-center pt-3">
        <button className="w-9 h-9 rounded-full bg-card border border-inkline grid place-items-center" onClick={() => nav(-1)}>‹</button>
        <h1 className="text-[26px] font-black tracking-tight ml-3">设置</h1>
      </div>
      {msg && <div className="mt-4 ghost-btn text-sm px-4 py-2.5 rounded-2xl">{msg}</div>}

      <Block title="我的资料"><ProfileCard onFlash={flash} onChanged={refresh} /></Block>
      <Block title="提醒与渠道"><ReminderCard st={mst} onSaved={(s: any) => { setMst(s); flash('提醒设置已保存') }} /></Block>

      {me.member.isAdmin && (
        <>
          <Block title="全局设置"><GlobalCard gst={gst} onSaved={(g: any) => { setGst(g); flash('全局设置已保存') }} onFlash={flash} /></Block>
          <Block title="成员管理">
            <div className="divide-y divide-inkline -mt-1">
              {members.map((m) => <MemberRow key={m.id} m={m} onChanged={load} onFlash={flash} />)}
            </div>
            <Btn ghost className="mt-3 !py-2 text-[13px]" onClick={() => setAddMember(true)}>+ 添加成员</Btn>
          </Block>
          <Block title="数据与运维">
            <div className="flex flex-wrap gap-2">
              <Btn ghost onClick={async () => {
                const r = await fetch('/api/admin/export')
                const blob = await r.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'yuliang-backup.json'
                a.click()
                flash('备份已导出(含全部成员,请妥善保管)')
              }}>导出全量备份</Btn>
              <Btn ghost onClick={async () => { const r = await api.post('/api/admin/fx-refresh'); flash(r.ok ? '汇率已更新' : '汇率源不可达,可先配手动汇率') }}>抓取汇率</Btn>
              <Btn ghost onClick={async () => { await api.post('/api/admin/engine-run'); flash('引擎已执行:提醒/月报/徽章已刷新') }}>跑一次引擎</Btn>
            </div>
            <div className="text-xs text-t3 mt-3">备份包含所有成员数据,由管理员保管;数据库在 volume 的 data/assetflix.db。</div>
          </Block>
        </>
      )}

      <button className="w-full sheet-card rounded-[24px] p-4 mt-6 text-[15px] font-bold text-down" onClick={() => logout()}>切换档案</button>
      <div className="text-center text-xs text-t3 mt-6 pb-4">
        成员数据彼此隔离 · <a className="underline" href="/v1" target="_blank">剧场版 V1 ↗</a>
      </div>

      <Sheet open={addMember} onClose={() => setAddMember(false)} title="添加成员">
        <MemberForm onSaved={() => { setAddMember(false); load(); flash('成员已添加') }} />
      </Sheet>
    </div>
  )
}

function Block({ title, children }: any) {
  return (
    <div className="mt-5">
      <h2 className="text-[11px] text-t3 tracking-widest mb-2">{title}</h2>
      <div className="sheet-card rounded-[24px] p-5">{children}</div>
    </div>
  )
}

function ProfileCard({ onFlash, onChanged }: any) {
  const { me } = useApp()
  const [f, setF] = useState<any>(null)
  useEffect(() => { if (me) setF({ name: me.member.name, emoji: me.member.emoji, color: me.member.color, password: '' }) }, [me])
  if (!f) return null
  const save = async () => {
    const body: any = { name: f.name, emoji: f.emoji, color: f.color }
    if (f.password) body.password = f.password
    await api.put('/api/me/profile', body)
    onFlash('资料已保存'); onChanged()
  }
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full grid place-items-center text-2xl text-white" style={{ background: f.color }}>{f.emoji}</div>
        <input className={inputCls + ' max-w-[200px]'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => setF({ ...f, emoji: e })} className={`w-9 h-9 rounded-xl grid place-items-center text-lg ${f.emoji === e ? 'bg-teal text-white' : 'bg-chip'}`}>{e}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} className={`w-8 h-8 rounded-full ${f.color === c ? 'ring-2 ring-offset-2 ring-teal' : ''}`} style={{ background: c }} />)}
      </div>
      <Field label={`密码${me.member.hasPassword ? '(留空不修改)' : '(当前未设置)'}`}>
        <input className={inputCls} type="password" value={f.password} placeholder="至少 4 位" onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <div className="flex gap-3 items-center">
        <Btn onClick={save}>保存</Btn>
        {me.member.hasPassword && (
          <button className="text-xs text-t3 underline" onClick={async () => { await api.put('/api/me/profile', { password: null }); onFlash('密码已清除'); onChanged() }}>清除密码</button>
        )}
      </div>
    </div>
  )
}

function ReminderCard({ st, onSaved }: any) {
  const [f, setF] = useState<any>(null)
  useEffect(() => { if (st) setF(JSON.parse(JSON.stringify(st))) }, [st])
  if (!f) return null
  const toggleTh = (n: number) => setF({ ...f, thresholds: f.thresholds.includes(n) ? f.thresholds.filter((x: number) => x !== n) : [...f.thresholds, n] })
  const addChannel = (type: string) => setF({ ...f, channels: [...f.channels, type === 'webhook' ? { type: 'webhook', url: '' } : { type: 'email', to: '' }] })
  const setCh = (i: number, k: string, v: string) => setF({ ...f, channels: f.channels.map((c: any, j: number) => (j === i ? { ...c, [k]: v } : c)) })
  const save = async () => onSaved(await api.put('/api/settings/member', f))
  return (
    <div>
      <Field label="提前提醒天数">
        <div className="flex gap-1.5 flex-wrap">
          {THRESHOLDS.map((n) => (
            <button key={n} onClick={() => toggleTh(n)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${f.thresholds.includes(n) ? 'bg-teal text-white' : 'bg-chip text-t2'}`}>{n} 天</button>
          ))}
        </div>
      </Field>
      <Field label="推送方式">
        <select className={inputCls} value={f.digest_hour ?? ''} onChange={(e) => setF({ ...f, digest_hour: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">立即推送(每条单独发)</option>
          <option value="8">每日摘要 · 早 8 点</option>
          <option value="12">每日摘要 · 午 12 点</option>
          <option value="20">每日摘要 · 晚 8 点</option>
        </select>
      </Field>
      <Field label="渠道">
        <div className="space-y-2">
          {f.channels.map((c: any, i: number) => (
            <div key={i} className="flex gap-2">
              <span className="text-[11px] text-t3 w-14 leading-loose">{c.type === 'webhook' ? 'Webhook' : 'Email'}</span>
              <input className={inputCls} value={c.url || c.to}
                placeholder={c.type === 'webhook' ? 'https://…(POST JSON)' : 'you@example.com'}
                onChange={(e) => setCh(i, c.type === 'webhook' ? 'url' : 'to', e.target.value)} />
              <button className="text-xs text-t3 px-1" onClick={() => setF({ ...f, channels: f.channels.filter((_: any, j: number) => j !== i) })}>删</button>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          <button className="text-xs text-teal-deep font-bold" onClick={() => addChannel('webhook')}>+ Webhook</button>
          <button className="text-xs text-teal-deep font-bold" onClick={() => addChannel('email')}>+ Email(需先配 SMTP)</button>
        </div>
      </Field>
      <div className="text-[11px] text-t3 mb-4">Webhook 收到 POST JSON:{`{ app, member, source, level, title, body, due_date }`} — 可对接 ntfy / Server酱 / 企业微信 / 钉钉 / 飞书。</div>
      <Btn onClick={save}>保存</Btn>
    </div>
  )
}

function GlobalCard({ gst, onSaved, onFlash }: any) {
  const [f, setF] = useState<any>(null)
  const [fxKey, setFxKey] = useState('')
  const [fxVal, setFxVal] = useState('')
  useEffect(() => { if (gst) setF(JSON.parse(JSON.stringify(gst))) }, [gst])
  if (!f) return null
  const save = async () => {
    await api.put('/api/settings/global', { base_currency: f.base_currency, quick_entry: f.quick_entry, fx_manual: f.fx_manual, smtp: f.smtp })
    onSaved(await api.get('/api/settings/global'))
  }
  return (
    <div>
      <div className="text-[11px] text-t3 mb-3">上次汇率抓取:{f.fx_last_fetch ? `${f.fx_last_fetch.date} ${f.fx_last_fetch.ok ? '成功' : '失败(用手动/旧值)'}` : '从未'}</div>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label="本位币">
          <select className={inputCls} value={f.base_currency} onChange={(e) => setF({ ...f, base_currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="免密快速进入">
          <button onClick={() => setF({ ...f, quick_entry: !f.quick_entry })}
            className={`w-full text-sm py-2.5 rounded-[14px] font-bold ${f.quick_entry ? 'bg-teal text-white' : 'bg-chip text-t3'}`}>
            {f.quick_entry ? '已开启' : '已关闭(需密码)'}
          </button>
        </Field>
      </div>
      <Field label="手动汇率(优先于自动,1 外币 = ? 本位币)">
        <div className="space-y-1.5">
          {Object.entries(f.fx_manual || {}).map(([k, v]: any) => (
            <div key={k} className="flex gap-2 items-center">
              <span className="text-xs w-10 text-t2">{k}</span>
              <input className={inputCls + ' !w-32'} type="number" step="any" value={v}
                onChange={(e) => setF({ ...f, fx_manual: { ...f.fx_manual, [k]: e.target.value } })} />
              <button className="text-xs text-t3" onClick={() => { const m = { ...f.fx_manual }; delete m[k]; setF({ ...f, fx_manual: m }) }}>删</button>
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <input className={inputCls + ' !w-20'} placeholder="币种" value={fxKey} onChange={(e) => setFxKey(e.target.value.toUpperCase())} />
            <input className={inputCls + ' !w-32'} type="number" step="any" placeholder="汇率" value={fxVal} onChange={(e) => setFxVal(e.target.value)} />
            <button className="text-xs text-teal-deep font-bold" onClick={() => { if (/^[A-Z]{3}$/.test(fxKey) && Number(fxVal) > 0) { setF({ ...f, fx_manual: { ...f.fx_manual, [fxKey]: fxVal } }); setFxKey(''); setFxVal('') } }}>添加</button>
          </div>
        </div>
      </Field>
      <Field label="SMTP 邮件">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="SMTP 服务器" value={f.smtp?.host || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), host: e.target.value } })} />
          <input className={inputCls} placeholder="端口(如 465)" value={f.smtp?.port || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), port: e.target.value } })} />
          <input className={inputCls} placeholder="账号" value={f.smtp?.user || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), user: e.target.value } })} />
          <input className={inputCls} type="password" placeholder={gst?.hasSmtpPass ? '已保存,留空不改' : '密码/授权码'} value={f.smtp?.pass || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), pass: e.target.value } })} />
          <input className={inputCls} placeholder="发件人(可选)" value={f.smtp?.from || ''} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), from: e.target.value } })} />
          <label className="flex items-center gap-2 text-sm text-t2"><input type="checkbox" checked={!!f.smtp?.secure} onChange={(e) => setF({ ...f, smtp: { ...(f.smtp || {}), secure: e.target.checked } })} />SSL(465 勾选)</label>
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
      <span className="w-10 h-10 rounded-full grid place-items-center text-base text-white" style={{ background: m.color }}>{m.emoji}</span>
      <div>
        <div className="text-sm font-bold">{m.name} {m.isAdmin ? <Chip>管理员</Chip> : null}</div>
        <div className="text-[11px] text-t3">{m.active ? '使用中' : '已停用'} · {m.hasPassword ? '有密码' : '免密'}</div>
      </div>
      <div className="ml-auto flex gap-3">
        <button className="text-xs text-teal-deep font-bold" onClick={() => setEditing(true)}>编辑</button>
        {!m.isAdmin && (
          <button className="text-xs text-t3"
            onClick={async () => { await api.put(`/api/admin/members/${m.id}`, { active: m.active ? false : true }); onChanged() }}>
            {m.active ? '停用' : '启用'}
          </button>
        )}
      </div>
      <Sheet open={editing} onClose={() => setEditing(false)} title={`编辑成员:${m.name}`}>
        <MemberForm member={m} onSaved={() => { setEditing(false); onChanged(); onFlash('成员已更新') }} />
      </Sheet>
    </div>
  )
}

function MemberForm({ member, onSaved }: any) {
  const [f, setF] = useState<any>(member ? { name: member.name, emoji: member.emoji, color: member.color, password: '', isAdmin: member.isAdmin } : { name: '', emoji: '🍿', color: '#0284C7', password: '', isAdmin: false })
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
      <div className="flex flex-wrap gap-1.5 mb-3">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => setF({ ...f, emoji: e })} className={`w-9 h-9 rounded-xl grid place-items-center text-lg ${f.emoji === e ? 'bg-teal text-white' : 'bg-chip'}`}>{e}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} className={`w-8 h-8 rounded-full ${f.color === c ? 'ring-2 ring-offset-2 ring-teal' : ''}`} style={{ background: c }} />)}
      </div>
      <Field label={member ? '重置密码(留空不改)' : '密码(可选)'}>
        <input className={inputCls} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="至少 4 位" />
      </Field>
      {!member && (
        <label className="flex items-center gap-2 text-sm text-t2 mb-4">
          <input type="checkbox" checked={f.isAdmin} onChange={(e) => setF({ ...f, isAdmin: e.target.checked })} />设为管理员
        </label>
      )}
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      <Btn onClick={save}>{member ? '保存' : '创建'}</Btn>
    </div>
  )
}
