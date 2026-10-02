import React, { useState } from 'react'
import { api, greeting, dateLabel } from '../api'
import { useApp } from '../App'
import { Btn, Field, inputCls } from '../ui'

export default function Profiles() {
  const { boot, refresh, login } = useApp()
  const [sel, setSel] = useState<any>(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [name, setName] = useState('')
  const [adminPw, setAdminPw] = useState('')
  const [busy, setBusy] = useState(false)

  if (!boot) return null

  if (boot.needsSetup) {
    const setup = async () => {
      setBusy(true); setErr('')
      try {
        await api.post('/api/setup', { name, password: adminPw || undefined })
        await refresh()
      } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
    }
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="font-black tracking-[0.12em] text-[16px] text-teal-deep">余粮</div>
            <div className="text-t3 text-xs mt-1.5">家有余粮,心里不慌</div>
          </div>
          <h1 className="text-[26px] font-black tracking-tight mb-6 text-center">创建第一位成员</h1>
          <Field label="名字">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:家主" />
          </Field>
          <Field label="密码(可选)" hint="内网信任环境可留空,点头像直接进入">
            <input className={inputCls} type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="至少 4 位" />
          </Field>
          {err && <div className="text-down text-sm mb-3">{err}</div>}
          <Btn className="w-full py-3" disabled={busy || !name.trim()} onClick={setup}>开始使用</Btn>
        </div>
      </div>
    )
  }

  const pick = async (m: any) => {
    setErr('')
    if (m.hasPassword && !boot.quickEntry) { setSel(m); setPw(''); return }
    try { await login(m.id) } catch (e: any) { setErr(e.message); setSel(m) }
  }
  const submitPw = async () => {
    setErr('')
    try { await login(sel.id, pw) } catch (e: any) { setErr(e.message || '密码错误') }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="font-black tracking-[0.12em] text-[16px] text-teal-deep">余粮</div>
        <div className="text-t3 text-xs mt-1.5 mb-12">{greeting()} · {dateLabel()}</div>
        <h1 className="text-[26px] font-black tracking-tight mb-8">今晚由谁坐镇?</h1>
        <div className="flex flex-wrap justify-center gap-6" data-testid="profile-grid">
          {boot.members.map((m: any) => (
            <button key={m.id} data-testid={`profile-${m.name}`} className="group w-24" onClick={() => pick(m)}>
              <div className="w-24 h-24 rounded-[28px] grid place-items-center text-4xl border border-inkline bg-card shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all"
                style={{ background: `linear-gradient(160deg, #ffffff 30%, ${m.color}18 100%)` }}>
                <span className="w-14 h-14 rounded-2xl grid place-items-center text-2xl text-white" style={{ background: m.color }}>{m.emoji}</span>
              </div>
              <div className="mt-2.5 text-[13px] text-t2 group-hover:text-t1">{m.name}</div>
            </button>
          ))}
        </div>

        {sel && (
          <div className="mt-9 text-left">
            <div className="text-[13px] text-t2 mb-2">「{sel.name}」的密码</div>
            <input className={inputCls} type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPw()} placeholder="输入密码进入" />
            <Btn className="w-full mt-3" onClick={submitPw}>进入</Btn>
          </div>
        )}
        {err && <div className="mt-4 text-down text-sm">{err}</div>}
        <div className="mt-14 text-xs text-t3">成员数据彼此隔离 · <a className="underline" href="/v1" target="_blank">剧场版 V1 ↗</a></div>
      </div>
    </div>
  )
}
