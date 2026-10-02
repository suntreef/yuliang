import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fmtCompact, daysUntil } from './api'
import { useApp, bus } from './App'

// ---------- 线性图标系统(1.8px 描边,跨平台一致) ----------
const ICON_PATHS: any = {
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 2.5 8 2.5 8h-17S6 15 6 8|M10.3 21a1.9 1.9 0 0 0 3.4 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
  sun: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7|M12 2.5v3|M12 18.5v3|M2.5 12h3|M18.5 12h3|M5.3 5.3l2.1 2.1|M16.6 16.6l2.1 2.1|M18.7 5.3l-2.1 2.1|M7.4 16.6l-2.1 2.1',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  plus: 'M12 5v14|M5 12h14',
  card: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5z|M3 10.5h18',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z|M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  home: 'M3.5 10.5L12 3l8.5 7.5|M5.5 9v11.5h13V9',
  wallet: 'M20 7H5.5A1.75 1.75 0 0 1 5.5 3.5H18V7|M20 7a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 20 19.5H5.5A1.75 1.75 0 0 1 3.75 17.75V5.25|M16 13.2h.01',
  target: 'M12 12m-8.5 0a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0|M12 12m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0|M12 12m-0.75 0a0.75 0.75 0 1 0 1.5 0a0.75 0.75 0 1 0-1.5 0',
  camera: 'M22 18.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5V9a1.5 1.5 0 0 1 1.5-1.5H7l2-2.5h6l2 2.5h3.5A1.5 1.5 0 0 1 22 9z|M12 16.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5',
  flame: 'M12 21.5c4 0 6.5-2.6 6.5-6 0-4.5-3.5-6-4.5-9-1 2.5-2 3.5-2 3.5S11.5 7 10 5c-.8 2.5-4.5 5-4.5 10.5 0 3.4 2.5 6 6.5 6z',
  ticket: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v3a2 2 0 0 0 0 4v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-3a2 2 0 0 0 0-4z|M13 6v12' ,
  check: 'M4.5 12.5l4.5 4.5L19.5 6.5',
  chevron: 'M9 5.5l6.5 6.5L9 18.5',
  left: 'M15 5.5L8.5 12l6.5 6.5',
  trash: 'M4 7h16|M9.5 7V4.5h5V7|M6.5 7l1 13h9l1-13|M10 11v5.5|M14 11v5.5',
}
export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }: any) {
  const d: string = ICON_PATHS[name] || ''
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

// ---------- 基础控件 ----------
export const inputCls = 'w-full bg-card border border-inkline rounded-[14px] px-3.5 py-2.5 text-[15px] outline-none focus:border-teal transition-colors placeholder:text-t3'
export function Field({ label, children, hint }: any) {
  return (
    <label className="block mb-4">
      <div className="text-[13px] text-t2 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-t3 mt-1.5">{hint}</div>}
    </label>
  )
}
export function Btn({ children, className = '', ghost, tone, ...p }: any) {
  const toneCls = tone === 'gold' ? 'bg-gold text-white hover:bg-amber-500'
    : tone === 'mint' ? 'bg-teal text-white hover:bg-teal-deep'
      : ghost ? 'ghost-btn'
        : 'text-white shadow-md shadow-teal/30 hover:brightness-105'
  const primaryStyle = !(ghost || tone) ? { background: 'linear-gradient(135deg, #0d9488, #0891b2)', boxShadow: '0 6px 16px rgba(13,148,136,.3), inset 0 1px 0 rgba(255,255,255,.35)' } : undefined
  return <button {...p} style={{ ...primaryStyle, ...p.style }} className={`btn-press px-4 py-2.5 rounded-[16px] font-bold text-[15px] disabled:opacity-40 ${toneCls} ${className}`}>{children}</button>
}
export function Chip({ children, tone = 'default' }: any) {
  return <span className={`tint tint-${tone}`}>{children}</span>
}
export function Empty({ icon = '🫧', text }: any) {
  return (
    <div className="text-center py-12">
      <div className="text-3xl mb-3 opacity-50">{icon}</div>
      <div className="text-sm text-t2">{text}</div>
    </div>
  )
}
// 语义:绿涨红跌(非炒股场景),与清爽色系统一
export function Delta({ value, ccy = 'CNY', compact = true }: { value: any, ccy?: string, compact?: boolean }) {
  const v = Number(value) || 0
  if (v === 0) return <span className="text-t3">持平</span>
  const up = v > 0
  return (
    <span className={`num font-bold ${up ? 'text-up' : 'text-down'}`}>
      {up ? '▲' : '▼'} {compact ? fmtCompact(Math.abs(v), ccy) : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Math.abs(v)) + ' ' + ccy}
    </span>
  )
}
export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(target)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}
export function BigNumber({ value, ccy }: { value: number, ccy: string }) {
  const v = useCountUp(value)
  return <span className="num text-[34px] leading-tight font-black">{fmtCompact(v, ccy)}</span>
}
export function ProgressBar({ pct, className = '' }: any) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className={`h-1.5 rounded-full bg-track overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${p >= 100 ? 'bg-up' : 'bg-teal'}`} style={{ width: p + '%', transition: 'width .6s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  )
}

// ---------- 顶栏 ----------
export function TopBar() {
  const { me } = useApp()
  const nav = useNavigate()
  const [pendings, setPendings] = useState<any[]>([])
  const [openMenu, setOpenMenu] = useState<'' | 'bell' | 'me'>('')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggleTheme = () => {
    const d = !dark
    setDark(d)
    document.documentElement.classList.toggle('dark', d)
    localStorage.setItem('yl_theme', d ? 'dark' : 'light')
  }
  const loadBell = () => api.get('/api/reminders?status=pending').then(setPendings).catch(() => {})
  useEffect(() => { loadBell() }, [])
  useEffect(() => bus.on('af:reminders-changed', loadBell), [])
  useEffect(() => {
    const close = () => setOpenMenu('')
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  const ack = async (r: any, action: string) => {
    await api.post(`/api/reminders/${r.id}/ack`, { action })
    loadBell(); bus.fire('af:reminders-changed'); bus.fire('af:today-changed')
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-stage/85 backdrop-blur-md safe-top">
      <div className="max-w-[560px] mx-auto flex items-center gap-3 px-4 h-[60px] md:h-[68px]">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-black tracking-[0.12em] text-[16px] text-teal-deep">余粮</span>
          <span className="hidden sm:inline text-[10px] text-t3 tracking-[0.22em] font-bold">YULIANG</span>
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <div onClick={(e) => e.stopPropagation()}>
            <button aria-label="通知" className="btn-press relative w-10 h-10 rounded-full grid place-items-center hover:bg-black/5 text-t1" onClick={() => setOpenMenu(openMenu === 'bell' ? '' : 'bell')}>
              <Icon name="bell" size={19} />
              {pendings.length > 0 && (
                <span className="absolute top-1 right-1 bg-urgent text-white text-[10px] font-bold min-w-[16px] h-4 px-0.5 rounded-full grid place-items-center">{pendings.length}</span>
              )}
            </button>
            {/* 固定锚定屏幕右缘,小屏不错位不溢出 */}
            {openMenu === 'bell' && (
              <div className="fixed right-3 top-[60px] md:top-[68px] w-[min(370px,calc(100vw-24px))] bg-card rounded-2xl border border-inkline shadow-2xl overflow-hidden z-50 anim-up">
                <div className="px-4 py-2.5 text-[11px] text-t3 border-b border-inkline">需要你处理</div>
                <div className="max-h-[56vh] overflow-y-auto">
                  {pendings.length === 0 && <div className="px-4 py-7 text-center text-sm text-t3">暂无待办,清爽 🍃</div>}
                  {pendings.slice(0, 8).map((r) => (
                    <div key={r.id} className="px-4 py-3 border-b border-inkline last:border-0">
                      <div className="text-sm font-bold leading-snug">{r.title}</div>
                      <div className="text-xs text-t2 mt-1 line-clamp-2">{r.body}</div>
                      <div className="mt-2 flex gap-2">
                        <button className="text-xs px-2.5 py-1 rounded-lg ghost-btn font-bold" onClick={() => ack(r, 'done')}>✓ 处理</button>
                        <button className="text-xs px-2.5 py-1 rounded-lg bg-chip text-t2" onClick={() => ack(r, 'dismissed')}>忽略</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button aria-label="切换明暗主题" className="btn-press w-10 h-10 rounded-full grid place-items-center hover:bg-black/5 text-t2" onClick={toggleTheme}>
            <Icon name={dark ? 'sun' : 'moon'} size={19} />
          </button>
          <button aria-label="设置" className="btn-press w-10 h-10 rounded-full grid place-items-center hover:bg-black/5 text-t2" onClick={() => nav('/settings')}>
            <Icon name="gear" size={19} />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="btn-press w-10 h-10 rounded-full grid place-items-center hover:bg-black/5" onClick={() => setOpenMenu(openMenu === 'me' ? '' : 'me')}>
              <span className="w-9 h-9 rounded-full grid place-items-center text-base text-white" style={{ background: me.member.color }}>{me.member.emoji}</span>
            </button>
            {openMenu === 'me' && (
              <div className="fixed right-3 top-[60px] md:top-[68px] w-52 bg-card rounded-2xl border border-inkline shadow-2xl overflow-hidden text-sm z-50 anim-up">
                <div className="px-4 py-3 border-b border-inkline">
                  <div className="font-bold">{me.member.name}</div>
                  <div className="text-xs text-t2 mt-0.5">{me.level.title} · {me.level.xp} XP · 🔥 连囤 {me.streak} 期</div>
                </div>
                <button className="w-full text-left px-4 py-2.5 hover:bg-hover flex items-center gap-2.5" onClick={() => { setOpenMenu(''); nav('/settings') }}>
                  <Icon name="gear" size={15} className="text-t2" />设置
                </button>
                <a className="block w-full text-left px-4 py-2.5 text-t3 text-xs hover:bg-hover" href="/v1" target="_blank">回到剧场版 V1 ↗</a>
                <LogoutItem />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
function LogoutItem() {
  const { logout } = useApp()
  return <button className="w-full text-left px-4 py-2.5 hover:bg-hover" onClick={() => logout()}>切换档案</button>
}

// ---------- iOS 式浮动 Tab(玻璃胶囊 + 弹性滑块) ----------
export function TabBar() {
  const nav = useNavigate()
  const tabs = [['/', '今天', 'home'], ['/vault', '财库', 'wallet'], ['/journal', '报告', 'book']] as const
  const idx = tabs.findIndex(([to]) => to === window.location.pathname)
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      <div className="pointer-events-auto mx-auto w-[min(94%,400px)] mb-2.5">
        <div className="glass-strong relative flex rounded-full">
          <div className={`capsule-shine absolute top-[5px] bottom-[5px] left-[5px] rounded-full ${idx < 0 ? 'opacity-0' : ''}`}
            style={{
              width: `calc((100% - 10px) / ${tabs.length})`,
              transform: `translateX(calc(${Math.max(0, idx)} * 100%))`,
              transition: 'transform 0.45s cubic-bezier(0.32, 1.35, 0.5, 1), opacity 0.25s ease',
              background: 'linear-gradient(135deg, #0d9488, #0891b2)',
              boxShadow: '0 6px 18px rgba(13, 148, 136, 0.45)',
            }} />
          {tabs.map(([to, label, icon]) => {
            const active = to === window.location.pathname
            return (
              <button key={to} onClick={() => nav(to)}
                className={`btn-press relative z-10 flex-1 py-2.5 text-center transition-colors duration-300 ${active ? 'text-white' : 'text-t2'}`}>
                <div className="grid place-items-center"><Icon name={icon} size={19} strokeWidth={active ? 2.1 : 1.8} /></div>
                <div className="text-[10px] font-bold mt-0.5">{label}</div>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

// ---------- iOS 式分段器(滑动白色滑块) ----------
export function Segmented({ value, options, onChange }: any) {
  const idx = Math.max(0, (options as any[]).findIndex(([v]) => v === value))
  return (
    <div className="glass-strong relative flex rounded-full p-1">
      <div className="absolute top-1 bottom-1 left-1 rounded-full bg-card shadow-sm"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(calc(${idx} * 100%))`,
          transition: 'transform 0.35s cubic-bezier(0.32, 1.25, 0.5, 1)',
        }} />
      {options.map(([v, label]: any) => (
        <button key={v} onClick={() => onChange(v)}
          className={`btn-press relative z-10 flex-1 py-1.5 rounded-full text-[13px] font-bold transition-colors ${value === v ? 'text-teal-deep' : 'text-t2'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------- 三环 ----------
export function Ring({ ratio, label, color = '#0d9488', size = 52 }: any) {
  const r = (size - 7) / 2
  const C = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, ratio || 0))
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--c-track)" strokeWidth="4.5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth="4.5" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 2px 4px ${color}44)` }} />
      </svg>
      <div className="text-[10px] text-t3">{label}</div>
    </div>
  )
}

// ---------- 行动卡 ----------
export function ActionCard({ level = 'info', icon, title, fact, action, children }: any) {
  const bar = level === 'urgent' ? 'bg-urgent' : level === 'warning' ? 'bg-amber-400' : level === 'habit' ? 'bg-gold' : 'bg-track'
  return (
    <div className="rise sheet-card rounded-[20px] p-4 flex gap-3">
      <div className={`w-1 rounded-full shrink-0 ${bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[15px] leading-snug">{title}</div>
            {fact && <div className="text-[13px] text-t2 mt-1 leading-relaxed">{fact}</div>}
          </div>
          {action}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

// ---------- 图表(触点拖动) ----------
export function ScrubChart({ series, height = 200 }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const [hi, setHi] = useState<number | null>(null)
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  if (!series || series.length < 2) return <Empty icon="📈" text="记下第一笔快照,曲线才会长出来" />
  const W = 800
  const H = height
  const P = 12
  const vals = series.map((p: any) => p.net)
  let min = Math.min(...vals, 0)
  let max = Math.max(...vals, 1)
  if (min === max) { min -= 1; max += 1 }
  const x = (i: number) => P + (i / (series.length - 1)) * (W - 2 * P)
  const y = (v: number) => P + (1 - (v - min) / (max - min)) * (H - 2 * P)
  const line = series.map((p: any, i: number) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ')
  const area = `${line} L${x(series.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`
  const first = vals[0]
  const last = vals[vals.length - 1]
  const color = last >= first ? '#0d9488' : '#f43f5e'
  const hp = hi != null ? series[hi] : null
  const lx = x(series.length - 1)
  const ly = y(last)

  const locate = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setHi(Math.round(r * (series.length - 1)))
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap min-h-[2.4rem]">
        {hp ? (
          <>
            <span className="num text-[26px] font-black">{fmtCompact(hp.net)}</span>
            <span className="text-xs text-t3">{hp.date}</span>
            <button className="ml-auto text-xs text-t3 underline" onClick={() => setHi(null)}>回到最新</button>
          </>
        ) : (
          <>
            <span className="num text-[26px] font-black">{fmtCompact(last)}</span>
            <Delta value={last - first} />
            <span className="ml-auto text-xs text-t3">{series[0].date} → {series[series.length - 1].date}</span>
          </>
        )}
      </div>
      <div ref={ref} className="mt-2"
        onPointerDown={(e) => locate(e.clientX)}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') locate(e.clientX) }}
        onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid + 'a'} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="70%" stopColor={color} stopOpacity="0.05" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} y1={P + f * (H - 2 * P)} x2={W - P} y2={P + f * (H - 2 * P)}
              stroke="var(--c-line)" strokeDasharray="3 6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={P} y1={y(0)} x2={W - P} y2={y(0)} stroke="var(--c-grid)" strokeDasharray="4 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={`url(#${gid}a)`} />
          <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} className="chart-line" vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 3px 5px ${color}55)` }} />
          {hp ? (
            <g>
              <line x1={x(hi)} y1={P} x2={x(hi)} y2={H - P} stroke="var(--c-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hi)} cy={y(hp.net)} r="4.5" fill="var(--c-card)" stroke={color} strokeWidth="2.5" />
            </g>
          ) : (
            <g>
              <circle cx={lx} cy={ly} r="5" fill="none" stroke={color} strokeWidth="2" className="chart-pulse" />
              <circle cx={lx} cy={ly} r="4.5" fill={color} stroke="var(--c-card)" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-t3 mt-1">
        <span>低 {fmtCompact(min)}</span>
        <span>高 {fmtCompact(max)}</span>
      </div>
    </div>
  )
}

// ---------- 抽屉(移动端支持下拉关闭) ----------
export function Sheet({ open, onClose, title, children, wide }: any) {
  const [dy, setDy] = useState(0)
  const startY = useRef<number | null>(null)
  useEffect(() => { if (open) setDy(0) }, [open])
  if (!open) return null
  const down = (e: any) => { startY.current = e.clientY }
  const move = (e: any) => {
    if (startY.current == null || e.pointerType === 'mouse') return
    setDy(Math.max(0, e.clientY - startY.current))
  }
  const up = () => {
    if (dy > 90) { startY.current = null; onClose() } else setDy(0)
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-6"
      style={{ animation: 'v3-fade .2s ease both' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-card rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] overflow-y-auto anim-up`}>
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur px-5 pt-3 pb-3.5 border-b border-inkline rounded-t-[24px]">
          <div className="sm:hidden mx-auto w-10 h-1.5 rounded-full bg-track mb-3 cursor-grab touch-none select-none"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <div className="flex items-center">
            <h3 className="font-bold text-[17px]">{title}</h3>
            <button aria-label="关闭" className="btn-press ml-auto w-8 h-8 rounded-full bg-chip hover:bg-track leading-none" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  )
}
