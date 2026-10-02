import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import Profiles from './pages/Profiles'
import Home from './pages/Home'
import Cards from './pages/Cards'
import Assets from './pages/Assets'
import Reports, { ReportDetail } from './pages/Reports'
import Achievements from './pages/Achievements'
import Settings from './pages/Settings'
import { TopBar, BottomNav } from './ui'

const Ctx = createContext<any>(null)
export const useApp = () => useContext(Ctx)

// 轻量事件总线:提醒处理后让顶栏红点刷新
export const bus = {
  fire: (name: string) => window.dispatchEvent(new Event(name)),
  on(name: string, fn: () => void) {
    window.addEventListener(name, fn)
    return () => window.removeEventListener(name, fn)
  },
}

export default function App() {
  const [boot, setBoot] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const b = await api.get('/api/bootstrap')
    setBoot(b)
    try {
      const m = await api.get('/api/me')
      setMe(m)
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
    return <div className="min-h-screen grid place-items-center text-gray-500 tracking-widest">ASSETFLIX · 加载中…</div>
  }

  return (
    <Ctx.Provider value={{ boot, me, refresh, login, logout }}>
      {me ? (
        <div className="min-h-screen pb-20 md:pb-6">
          <TopBar />
          <main className="pt-14 md:pt-16 max-w-[1800px] mx-auto pb-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cards" element={<Cards />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      ) : (
        <Profiles />
      )}
    </Ctx.Provider>
  )
}
