import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api, fmtMoney, fmtCompact, daysUntil } from './api'
import { useApp, bus } from './App'

// ---------- 基础控件 ----------
export const inputCls = 'w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm outline-none focus:border-nfx-red'
export function Field({ label, children }: any) {
  return (
    <label className="block mb-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      {children}
    </label>
  )
}
export function Btn({ children, className = '', ghost, ...p }: any) {
  return (
    <button {...p}
      className={`px-4 py-2 rounded font-bold text-sm disabled:opacity-40 ${ghost ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-nfx-red hover:bg-red-700 text-white'} ${className}`}>
      {children}
    </button>
  )
}
export function Empty({ icon = '🍿', text }: any) {
  return (
    <div className="text-center py-10 text-gray-500">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

// ---------- 导航 ----------
const NAV = [
  ['/', '首页'], ['/cards', '卡包'], ['/assets', '资产'], ['/reports', '月报'], ['/achievements', '成就'],
] as const

export function TopBar() {
  const { me, logout } = useApp()
  const nav = useNavigate()
  const [pendings, setPendings] = useState<any[]>([])
  const [openMenu, setOpenMenu] = useState<'' | 'bell' | 'avatar'>('')

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
    loadBell()
    bus.fire('af:reminders-changed')
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/95 to-black/55 safe-top">
      <div className="max-w-[1800px] mx-auto flex items-center gap-4 md:gap-6 px-4 md:px-10 h-14">
        <Link to="/" className="text-nfx-red font-black text-lg md:text-xl tracking-[0.2em]">ASSETFLIX</Link>
        <nav className="hidden md:flex gap-5 text-sm">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'text-white font-bold' : 'text-gray-300 hover:text-white'}>{label}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button data-testid="bell" className="relative text-xl hover:opacity-80" onClick={() => setOpenMenu(openMenu === 'bell' ? '' : 'bell')}>
              🔔
              {pendings.length > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-nfx-red text-[10px] font-bold min-w-[16px] h-4 px-0.5 rounded-full grid place-items-center">{pendings.length}</span>
              )}
            </button>
            {openMenu === 'bell' && (
              <div className="absolute right-0 mt-2 w-[320px] max-w-[86vw] bg-nfx-card rounded-lg shadow-2xl border border-white/10 overflow-hidden">
                <div className="px-4 py-2 text-xs text-gray-400 border-b border-white/10">待处理提醒</div>
                <div className="max-h-[50vh] overflow-y-auto">
                  {pendings.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">暂无待办,追剧愉快 🍿</div>}
                  {pendings.slice(0, 8).map((r) => (
                    <div key={r.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/5">
                      <div className="text-sm font-bold leading-tight">{r.title}</div>
                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">{r.body}</div>
                      <div className="mt-2 flex gap-2">
                        <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={() => ack(r, 'done')}>✓ 处理</button>
                        <button className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400" onClick={() => ack(r, 'dismissed')}>忽略</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button className="flex items-center gap-2" onClick={() => setOpenMenu(openMenu === 'avatar' ? '' : 'avatar')}>
              <span className="w-9 h-9 rounded-md grid place-items-center text-lg" style={{ background: me.member.color }}>{me.member.emoji}</span>
              <span className="hidden lg:block text-xs text-gray-300">{me.level.title}</span>
            </button>
            {openMenu === 'avatar' && (
              <div className="absolute right-0 mt-2 w-48 bg-nfx-card rounded-lg shadow-2xl border border-white/10 overflow-hidden text-sm">
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="font-bold">{me.member.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{me.level.title} · {me.level.xp} XP</div>
                </div>
                <button className="w-full text-left px-4 py-2.5 hover:bg-white/10" onClick={() => { setOpenMenu(''); nav('/settings') }}>⚙️ 设置</button>
                <button className="w-full text-left px-4 py-2.5 hover:bg-white/10" onClick={() => { setOpenMenu(''); logout() }}>↩ 切换档案</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  const tabs = [['/', '🏠', '首页'], ['/cards', '💳', '卡包'], ['/assets', '💰', '资产'], ['/achievements', '🏆', '成就'], ['/settings', '⚙️', '我的']] as const
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-black/95 border-t border-white/10 safe-bottom">
      <div className="flex">
        {tabs.map(([to, icon, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex-1 py-2 text-center ${isActive ? 'text-white' : 'text-gray-500'}`}>
            <div className="text-lg leading-none">{icon}</div>
            <div className="text-[10px] mt-1">{label}</div>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ---------- 内容行(横向滚动) ----------
export function Row({ title, to, children }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 400, behavior: 'smooth' })
  const count = React.Children.count(children)
  if (!count) return null
  return (
    <section className="mt-7 md:mt-9">
      <div className="flex items-baseline px-4 md:px-10 mb-1">
        <h2 className="text-base md:text-lg font-bold">{title}</h2>
        {to && <Link className="ml-auto text-xs text-gray-400 hover:text-white" to={to}>更多 ›</Link>}
      </div>
      <div className="relative group">
        <button onClick={() => scroll(-1)} aria-label="向左"
          className="hidden md:grid absolute left-0 top-0 bottom-0 w-10 z-30 place-items-center text-3xl bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity">‹</button>
        <div ref={ref} className="flex gap-3 md:gap-4 overflow-x-auto row-scroll px-4 md:px-10 py-2">{children}</div>
        <button onClick={() => scroll(1)} aria-label="向右"
          className="hidden md:grid absolute right-0 top-0 bottom-0 w-10 z-30 place-items-center text-3xl bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity">›</button>
      </div>
    </section>
  )
}

// ---------- 海报卡 ----------
export function Poster({ onClick, children, className = '', style }: any) {
  return (
    <div onClick={onClick} style={style}
      className={`card-hover relative shrink-0 w-[126px] sm:w-[150px] md:w-[168px] aspect-[2/3] rounded-md overflow-hidden cursor-pointer bg-nfx-card ${className}`}>
      {children}
    </div>
  )
}

const hue = (s: string) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }

export function CountdownChip({ date, label }: { date?: string | null, label: string }) {
  const d = daysUntil(date)
  if (d == null) return null
  const cls = d <= 1 ? 'bg-nfx-red text-white' : d <= 7 ? 'bg-orange-500 text-white' : d <= 30 ? 'bg-yellow-600/90 text-white' : 'bg-black/70 text-gray-300'
  return <span className={`absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded font-bold ${cls}`}>
    {d <= 0 ? `${label}·今天` : `${label} ${d}天`}
  </span>
}

export function ProgressBar({ pct, className = '' }: any) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className={`h-1.5 rounded-full bg-white/15 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-nfx-red" style={{ width: p + '%' }} />
    </div>
  )
}

export const waiverPct = (c: any) =>
  c.waiver_type === 'count' && c.waiver_count ? Math.min(100, ((c.progress_count || 0) / c.waiver_count) * 100)
    : c.waiver_type === 'amount' && c.waiver_amount ? Math.min(100, ((c.progress_amount || 0) / c.waiver_amount) * 100)
      : 0

export function CardPoster({ card, onClick }: any) {
  const h = hue(card.bank)
  return (
    <Poster onClick={onClick} style={{ background: `linear-gradient(160deg, hsl(${h},45%,26%), hsl(${(h + 40) % 360},55%,10%))` }}>
      <CountdownChip date={card.next_fee_date} label="年费" />
      {card.archived > 0 && <span className="absolute top-2 left-2 z-10 bg-black/70 text-[10px] px-1.5 py-0.5 rounded">已归档</span>}
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="text-[11px] text-white/80 truncate">🏦 {card.bank}</div>
        <div className="mt-5 text-center text-4xl opacity-90">💳</div>
        <div className="mt-2 text-center text-sm font-bold leading-tight line-clamp-2">{card.name}</div>
        <div className="mt-auto">
          <div className="text-[10px] text-white/60">年费</div>
          <div className="text-sm font-bold">{fmtMoney(card.annual_fee, card.currency)}</div>
          {(card.waiver_type === 'count' || card.waiver_type === 'amount') && <ProgressBar pct={waiverPct(card)} className="mt-1.5" />}
        </div>
      </div>
    </Poster>
  )
}

const BENEFIT_ICONS: any = { count: '🎁', date: '📅', amount: '💵' }
export function BenefitPoster({ b, onClick }: any) {
  const pct = b.type === 'count' && b.total_count ? ((b.used_count || 0) / b.total_count) * 100 : 0
  return (
    <Poster onClick={onClick} style={{ background: 'linear-gradient(160deg,#26262e,#131318)' }}>
      <CountdownChip date={b.expire_date} label="到期" />
      {b.archived > 0 && <span className="absolute top-2 left-2 z-10 bg-black/70 text-[10px] px-1.5 py-0.5 rounded">已归档</span>}
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="text-[11px] text-white/60">{BENEFIT_ICONS[b.type]} {b.type === 'count' ? '次数' : b.type === 'amount' ? '金额' : '日期'}</div>
        <div className="mt-5 text-center text-4xl">{BENEFIT_ICONS[b.type] || '🎁'}</div>
        <div className="mt-2 text-center text-sm font-bold leading-tight line-clamp-2">{b.name}</div>
        <div className="mt-auto">
          {b.type === 'count' && b.total_count ? (
            <>
              <div className="text-[10px] text-white/60">已用 {b.used_count || 0}/{b.total_count}</div>
              <ProgressBar pct={pct} className="mt-1" />
            </>
          ) : (
            <div className="text-[11px] text-white/70">{b.value ? `价值 ${fmtMoney(b.value, b.currency)}` : '—'}</div>
          )}
        </div>
      </div>
    </Poster>
  )
}

export function BadgePoster({ badge }: any) {
  const earned = !!badge.earned_at
  return (
    <Poster className={earned ? '' : 'grayscale opacity-50'} style={{ background: earned ? 'linear-gradient(160deg,#3d2c10,#181310)' : '#1b1b1b' }}>
      <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center">
        <div className="text-4xl">{earned ? badge.icon : '🔒'}</div>
        <div className="mt-2 text-sm font-bold">{badge.name}</div>
        <div className="mt-1 text-[10px] text-white/60 leading-tight">{badge.desc}</div>
        {earned && <div className="mt-2 text-[10px] text-amber-400">✓ {badge.earned_at}</div>}
      </div>
    </Poster>
  )
}

export function ReportPoster({ r, onClick }: any) {
  return (
    <Poster onClick={onClick} style={{ background: 'linear-gradient(160deg,#20202a,#0f0f14)' }}>
      {!r.seen && <span className="absolute top-2 right-2 z-10 bg-nfx-red text-[10px] px-1.5 py-0.5 rounded font-bold">NEW</span>}
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="text-3xl text-center mt-5">📺</div>
        <div className="mt-2 text-center font-bold text-sm">{r.period} 月报</div>
        <div className="mt-1 text-center text-[10px] text-white/60 leading-tight line-clamp-2">{r.headline}</div>
        <div className="mt-auto text-center text-[10px] text-white/40">{r.seen ? '✓ 已观看' : '尚未观看'}</div>
      </div>
    </Poster>
  )
}

export function GoalPoster({ g, onClick }: any) {
  const pct = Math.min(100, ((g.current_amount || 0) / g.target_amount) * 100)
  return (
    <Poster onClick={onClick} style={{ background: 'linear-gradient(160deg,#14301f,#0d1712)' }}>
      {g.done ? <span className="absolute top-2 right-2 z-10 bg-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-bold">达成</span> : null}
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="text-3xl text-center mt-5">🎯</div>
        <div className="mt-2 text-center text-sm font-bold leading-tight line-clamp-2">{g.name}</div>
        <div className="mt-auto">
          <div className="text-[10px] text-white/60">{Math.round(pct)}% · {fmtCompact(g.current_amount, g.currency)}</div>
          <ProgressBar pct={pct} className="mt-1" />
          {g.due_date && <div className="text-[10px] text-white/40 mt-1">截止 {g.due_date}</div>}
        </div>
      </div>
    </Poster>
  )
}

const TYPE_META: any = { cash: ['🪙', '现金'], bank: ['🏦', '储蓄理财'], invest: ['📈', '投资'], pension: ['🧧', '公积金'], points: ['🎁', '积分'], liability: ['🏠', '负债'] }
export function AccountPoster({ a, onClick }: any) {
  const [icon] = TYPE_META[a.type] || ['💼', '账户']
  return (
    <Poster onClick={onClick} style={{ background: 'linear-gradient(160deg,#232330,#101016)' }}>
      <div className="absolute inset-0 p-3 flex flex-col">
        <div className="text-[11px] text-white/60">{icon} {TYPE_META[a.type]?.[1] || a.type}</div>
        <div className="mt-5 text-center text-3xl">{icon}</div>
        <div className="mt-2 text-center text-sm font-bold leading-tight line-clamp-2">{a.name}</div>
        <div className="mt-auto">
          <div className="text-[10px] text-white/50">{a.latest_date || '未记录'}</div>
          <div className={`text-sm font-bold ${a.type === 'liability' ? 'text-orange-400' : ''}`}>{a.latest_value != null ? fmtMoney(a.latest_value, a.currency) : '—'}</div>
        </div>
      </div>
    </Poster>
  )
}

export function ReminderCard({ r, onAck }: any) {
  const border = r.level === 'urgent' ? 'border-l-nfx-red' : r.level === 'warning' ? 'border-l-orange-500' : 'border-l-gray-600'
  return (
    <div className={`card-hover shrink-0 w-[290px] bg-nfx-card rounded-md border-l-4 ${border} p-3 flex flex-col`}>
      <div className="text-sm font-bold leading-tight">{r.title}</div>
      <div className="mt-1 text-xs text-gray-400 leading-relaxed line-clamp-3 flex-1">{r.body}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-gray-500">{r.due_date || ''}</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => onAck(r, 'done')} className="px-2.5 py-1 text-xs rounded bg-white/10 hover:bg-white/20 font-bold">✓ 处理</button>
          <button onClick={() => onAck(r, 'dismissed')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-gray-400">忽略</button>
        </div>
      </div>
    </div>
  )
}

// ---------- 弹层(手机全屏 / 桌面居中) ----------
export function Modal({ open, onClose, title, children, wide }: any) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-xl'} bg-nfx-card rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto pop-in`}>
        <div className="sticky top-0 z-10 bg-nfx-card/95 backdrop-blur px-5 pt-4 pb-3 flex items-center border-b border-white/10">
          <h3 className="font-bold text-lg">{title}</h3>
          <button aria-label="关闭" className="ml-auto w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-lg leading-none" onClick={onClose}>✕</button>
        </div>
        <div className="px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  )
}

// ---------- 净资产曲线(SVG 手绘) ----------
export function Sparkline({ series, height = 230 }: any) {
  if (!series || series.length < 2) return <Empty icon="📉" text="数据还不够,先记录几笔快照" />
  const W = 800
  const H = height
  const P = 10
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
  const up = last >= first
  const color = up ? '#e50914' : '#9ca3af'
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl md:text-3xl font-black">{fmtCompact(last)}</span>
        <span className={`text-sm font-bold ${up ? 'text-nfx-red' : 'text-gray-400'}`}>{up ? '▲' : '▼'} {fmtCompact(last - first)}</span>
        <span className="ml-auto text-xs text-gray-500">{series[0].date} → {series[series.length - 1].date}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height }} preserveAspectRatio="none" data-testid="networth-chart">
        <line x1={P} y1={y(0)} x2={W - P} y2={y(0)} stroke="#ffffff22" strokeDasharray="4 4" strokeWidth="1" />
        <path d={area} fill={color} fillOpacity="0.18" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
