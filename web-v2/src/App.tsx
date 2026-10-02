import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api'
import Profiles from './pages/Profiles'
import Today from './pages/Today'
import Vault from './pages/Vault'
import Journal, { JournalDetail } from './pages/Journal'
import Settings from './pages/Settings'
import { TopBar, TabBar } from './ui'

const Ctx = createContext<any>(null)
export const useApp = () => useContext(Ctx)

export const bus = {
  fire: (name: string) => window.dispatchEvent(new Event(name)),
  on(name: string, fn: () => void) {
    window.addEventListener(name, fn)
    return () => window.removeEventListener(name, fn)
  },
}

// Tab 顺序决定切换动画方向
export const TAB_ORDER = ['/', '/vault', '/journal']
export function tabDir(from: string, to: string) {
  if (to === '/settings') return 'up'
  if (from === '/settings') return 'down'
  const a = TAB_ORDER.indexOf(from)
  const b = TAB_ORDER.indexOf(to)
  if (a < 0 || b < 0) return 'left'
  return b > a ? 'left' : 'right'
}

export default function App() {
  const [boot, setBoot] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const b = await api.get('/api/bootstrap')
    setBoot(b)
    try {
      setMe(await api.get('/api/me'))
    } catch { setMe(null) }
    setLoading(false)
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const login = async (memberId: number, password?: string) => {
    await api.post('/api/session', { member_id: memberId, password })
    await refresh()
  }
  const logout = async () => {
    await api.del('/api/session')
    setMe(null)
    await refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <div className="splash-mark w-16 h-16 mx-auto rounded-[20px] grid place-items-center text-3xl text-white shadow-lg shadow-teal/30"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0284c7)' }}>余</div>
          <div className="mt-4 font-black tracking-[0.2em] text-[15px] text-teal-deep">余粮</div>
          <div className="text-t3 text-[11px] mt-1">家有余粮,心里不慌</div>
        </div>
      </div>
    )
  }

  return (
    <Ctx.Provider value={{ boot, me, refresh, login, logout }}>
      {me ? <Shell /> : <Profiles />}
    </Ctx.Provider>
  )
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { me } = useApp()

  // 记忆上次停留的 Tab:再次打开直达
  useEffect(() => {
    const last = localStorage.getItem('yl_last_tab')
    if (last && TAB_ORDER.includes(last) && TAB_ORDER.includes(location.pathname) && location.pathname === '/') {
      navigate(last, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])
  useEffect(() => {
    if (TAB_ORDER.includes(location.pathname)) localStorage.setItem('yl_last_tab', location.pathname)
  }, [location.pathname])
  // 方向感知:本次渲染时由上一个路径决定动画方向
  const prev = useRef<string | null>(null)
  const dirRef = useRef('left')
  if (prev.current !== location.pathname) {
    if (prev.current) dirRef.current = tabDir(prev.current, location.pathname)
    prev.current = location.pathname
  }

  // 手机左右滑动切换 Tab
  const touch = useRef<{ x: number, y: number, ok: boolean } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    const el = e.target as HTMLElement
    touch.current = { x: t.clientX, y: t.clientY, ok: !el.closest('input, textarea, select, button, a, [data-noswipe]') }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    if (!s?.ok) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 60) return
    const i = TAB_ORDER.indexOf(location.pathname)
    if (i < 0) return
    const next = dx < 0 ? TAB_ORDER[i + 1] : TAB_ORDER[i - 1]
    if (next) navigate(next)
  }

  return (
    <div className="min-h-screen">
      <TopBar />
      <main
        className="pt-[60px] md:pt-[68px] pb-[128px] max-w-[560px] mx-auto px-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div key={location.pathname} className={`anim-${dirRef.current}`} data-noswipe="route">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:id" element={<JournalDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <TabBar />
    </div>
  )
}
