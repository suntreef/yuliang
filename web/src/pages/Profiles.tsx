import React, { useState } from 'react'
import { api } from '../api'
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

  // ---------- 首次启动:创建管理员 ----------
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
        <div className="w-full max-w-sm text-center">
          <div className="text-nfx-red font-black text-3xl tracking-[0.25em] mb-2">ASSETFLIX</div>
          <div className="text-gray-500 text-sm mb-8">你的资产剧场,即将开演</div>
          <h1 className="text-xl font-bold mb-6">创建第一位成员(管理员)</h1>
          <div className="text-left">
            <Field label="名字">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:家主" />
            </Field>
            <Field label="密码(可选,内网信任环境可留空)">
              <input className={inputCls} type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="至少 4 位" />
            </Field>
            {err && <div className="text-nfx-red text-sm mb-3">{err}</div>}
            <Btn className="w-full py-3" disabled={busy || !name.trim()} onClick={setup}>开演 🎬</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ---------- 档案选择 ----------
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
      <div className="w-full max-w-2xl text-center">
        <div className="text-nfx-red font-black text-2xl md:text-3xl tracking-[0.25em] mb-10">ASSETFLIX</div>
        <h1 className="text-xl md:text-2xl font-bold mb-8">谁在看盘?</h1>
        <div className="flex flex-wrap justify-center gap-5 md:gap-7" data-testid="profile-grid">
          {boot.members.map((m: any) => (
            <button key={m.id} data-testid={`profile-${m.name}`} className="group w-20 md:w-24" onClick={() => pick(m)}>
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl grid place-items-center text-4xl md:text-5xl ring-white/0 group-hover:ring-4 ring-inset transition-all"
                style={{ background: m.color }}>
                {m.emoji}
              </div>
              <div className="mt-2 text-sm text-gray-400 group-hover:text-white">{m.name}</div>
            </button>
          ))}
        </div>

        {sel && (
          <div className="mt-8 mx-auto max-w-xs text-left">
            <div className="text-sm text-gray-300 mb-2">「{sel.name}」的密码</div>
            <input className={inputCls} type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitPw()} placeholder="输入密码进入" />
            <Btn className="w-full mt-3" onClick={submitPw}>进入</Btn>
          </div>
        )}
        {err && <div className="mt-4 text-nfx-red text-sm">{err}</div>}
        <div className="mt-12 text-xs text-gray-600">内网自托管 · 成员数据彼此隔离</div>
      </div>
    </div>
  )
}
