import React, { useEffect, useState } from 'react'
import { api, fmtCompact } from '../api'
import { BadgePoster, ProgressBar, Empty } from '../ui'

export default function Achievements() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get('/api/badges').then(setData).catch(() => {}) }, [])
  if (!data) return null
  const { badges, level } = data
  const earned = badges.filter((b: any) => b.earned_at).length
  const nextPct = level.next ? Math.min(100, ((level.xp - level.min) / (level.next.at - level.min)) * 100) : 100

  return (
    <div className="px-4 md:px-10 py-6" data-testid="achievements-page">
      <h1 className="text-xl md:text-2xl font-black mb-1">成就与等级</h1>
      <p className="text-sm text-gray-400 mb-6">记录、复盘、用权益、处理提醒,都会攒 XP。</p>

      <div className="bg-nfx-card rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-nfx-red grid place-items-center text-2xl">🎬</div>
          <div>
            <div className="text-lg font-black">{level.title}</div>
            <div className="text-xs text-gray-400">{level.xp} XP{level.next ? ` · 距离「${level.next.title}」还差 ${level.next.at - level.xp} XP` : ' · 已满级'}</div>
          </div>
          <div className="ml-auto text-sm text-gray-400">{earned}/{badges.length} 徽章</div>
        </div>
        <ProgressBar pct={nextPct} className="mt-3" />
      </div>

      <h2 className="text-lg font-bold mt-8 mb-3">奖杯墙(灰色为未解锁)</h2>
      {!badges.length && <Empty icon="🏆" text="徽章加载中" />}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {badges.map((b: any) => <BadgePoster key={b.key} badge={b} />)}
      </div>
    </div>
  )
}
