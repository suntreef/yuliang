// 导航:顶栏(品牌章 + 通知/主题/设置/档案)+ iOS 浮动 Tab + 分段器
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useApp, bus } from '../App'
import { Icon } from './icons'

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
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', d ? '#121c17' : '#f3f7f4')
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
        {/* 品牌章 + 字标 */}
        <Link to="/" className="btn-press flex items-center gap-2.5">
          <span className="relative w-9 h-9 rounded-[12px] grid place-items-center text-white text-[17px] font-bold"
            style={{ background: 'var(--g-brand)', boxShadow: '0 4px 12px rgba(47, 143, 131, 0.35), inset 0 1px 0 rgba(255,255,255,.4)' }}>余</span>
          <span className="leading-none">
            <span className="block font-black text-[16px] tracking-[0.06em] text-t1">余粮</span>
            <span className="hidden sm:block text-[9px] tracking-[0.28em] text-t3 font-bold mt-0.5">YULIANG</span>
          </span>
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

// iOS 式浮动 Tab(玻璃胶囊 + 弹性滑块);仅三个主 Tab 页显示,设置/详情页自动隐藏
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
              background: 'var(--g-brand)',
              boxShadow: '0 6px 18px rgba(47, 143, 131, 0.45)',
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

// iOS 式分段器(滑动白色滑块)
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
          className={`btn-press relative z-10 flex-1 py-1.5 rounded-full text-[13px] font-bold transition-colors ${value === v ? 'text-brand-deep' : 'text-t2'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
