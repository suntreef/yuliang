import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, daysUntil, greeting, dateLabel } from '../api'
import { useApp, bus } from '../App'
import { Ring, ActionCard, BigNumber, Delta, ScrubChart, Btn, Chip, Icon } from '../ui'

const rankOf = (r: any) => {
  const d = daysUntil(r.due_date)
  if (d == null) return 4
  if (d < 0) return 0
  if (d <= 7) return 1
  if (d <= 30) return 2
  return 3
}

export default function Today() {
  const { me, refresh } = useApp()
  const nav = useNavigate()
  const [reminders, setReminders] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [net, setNet] = useState<any>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    api.get('/api/reminders?status=pending').then(setReminders).catch(() => {})
    api.get('/api/reports').then(setReports).catch(() => {})
    api.get('/api/benefits').then(setBenefits).catch(() => {})
    api.get('/api/cards').then(setCards).catch(() => {})
    api.get('/api/networth?days=90').then(setNet).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => bus.on('af:today-changed', load), [load])

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2200) }

  const items = reminders.filter((r) => r.source_type !== 'badge' && r.status === 'pending')
    .sort((a, b) => rankOf(a) - rankOf(b) || (a.due_date || '').localeCompare(b.due_date || ''))
  const shown = items.slice(0, 6)
  const rest = items.length - shown.length

  const latestReport = reports[0] || null
  const wasted30 = benefits
    .filter((b: any) => !b.archived && b.expire_date && (daysUntil(b.expire_date) ?? 99) <= 30)
    .reduce((s: number, b: any) => {
      const remain = b.type === 'count' ? Math.max(0, (b.total_count || 0) - (b.used_count || 0)) : 1
      return s + remain * (b.value || 0)
    }, 0)

  const series = net?.series || []
  const monthAgo = series.length > 30 ? series[series.length - 31] : series[0]
  const rings = [
    { label: '记快照', done: me.snapshotThisMonth, color: '#7c3aed' },
    { label: '读月报', done: me.unseenReports === 0, color: '#c026d3' },
    { label: '清待办', done: me.pendingReminders === 0, color: '#f59e0b' },
  ]
  const doneCount = rings.filter((r) => r.done).length

  const ack = async (r: any, action: string) => {
    await api.post(`/api/reminders/${r.id}/ack`, { action })
    load(); refresh(); bus.fire('af:reminders-changed')
  }
  const useBenefit = async (id: number) => {
    try {
      await api.post(`/api/benefits/${id}/use`, {})
      flash('已记录使用,+3 XP'); load(); refresh()
    } catch (e: any) { flash(e.message) }
  }
  const addCount = async (cardId: number) => {
    try {
      await api.post(`/api/cards/${cardId}/progress`, { add_count: 1 })
      flash('免年费进度 +1 笔'); load(); refresh()
    } catch (e: any) { flash(e.message) }
  }
  const benefitOf = (id: any) => benefits.find((b: any) => b.id === id)
  const cardOf = (id: any) => cards.find((c: any) => c.id === id)

  return (
    <div data-testid="today-page">
      {/* 问候 + 英雄卡(身家 + 三环) */}
      <div className="pt-3">
        <div className="text-t2 text-[15px]">{greeting()},{me.member.name}</div>
        <div className="text-t3 text-[13px] mt-0.5">{dateLabel()}</div>
      </div>
      <div className="rise glass-strong rounded-[24px] p-4 mt-4 relative overflow-hidden">
        <div className="absolute inset-0 spotlight pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-t3">净资产(本位币)</div>
            {net && series.length > 0 ? (
              <div className="mt-0.5"><BigNumber value={series[series.length - 1].net} ccy={net.base} /></div>
            ) : <div className="num text-[34px] font-black text-t3 leading-tight">—</div>}
            {net && series.length > 1 && (
              <div className="mt-0.5"><Delta value={series[series.length - 1].net - (monthAgo?.net ?? 0)} /></div>
            )}
          </div>
          <div className="flex gap-2.5 shrink-0 relative">
            {rings.map((r) => <Ring key={r.label} ratio={r.done ? 1 : 0.06} label={r.label} color={r.color} size={46} />)}
          </div>
        </div>
        <div className="relative mt-2 pt-2 border-t border-inkline flex items-center gap-3">
          <span className="text-[13px] font-bold">本月复盘 {doneCount}/3</span>
          <span className="text-[12px] text-amber-600 font-bold">🔥 连囤 {me.streak} 期</span>
          <span className="ml-auto text-[12px] text-t2">
            {doneCount === 3 ? '三环全满 🍃' : '把亮着的环填满'}
          </span>
        </div>
      </div>

      {/* 行动栈 */}
      <div className="flex items-baseline mt-7 mb-3">
        <h2 className="text-[17px] font-bold">需要你处理</h2>
        <span className="ml-2 text-t3 text-[13px]">{items.length} 件</span>
      </div>
      {items.length === 0 && (
        <div className="sheet-card rounded-[24px] p-6 text-center text-t2 text-sm rise">待办清零,享受今天 🍃</div>
      )}
      <div className="space-y-3">
        {shown.map((r: any) => {
          const d = daysUntil(r.due_date)
          const level = d != null && d < 0 ? 'urgent' : r.level
          const chip = <Chip tone={d != null && d <= 7 ? 'red' : d != null && d <= 30 ? 'amber' : 'default'}>{d == null ? '' : d <= 0 ? '今天' : `${d} 天`}</Chip>
          if (r.source_type === 'benefit') {
            const b = benefitOf(r.source_id)
            const canUse = b && b.type === 'count' && b.total_count != null && (b.used_count || 0) < b.total_count
            return (
              <ActionCard key={r.id} level={level} icon={<Icon name="ticket" size={18} />} title={r.title.replace('⏰ 权益到期:', '').replace('权益到期:', '')}
                fact={r.body} action={chip}>
                <div className="flex gap-2 flex-wrap">
                  {canUse && <Btn tone="mint" className="!py-2 !px-3.5 !text-[13px]" onClick={() => useBenefit(r.source_id)}>✓ 用掉了 +3XP</Btn>}
                  <Btn ghost className="!py-2 !px-3.5 !text-[13px]" onClick={() => ack(r, 'done')}>处理</Btn>
                  <button className="px-3.5 py-2 text-[13px] text-t3" onClick={() => ack(r, 'dismissed')}>忽略</button>
                </div>
              </ActionCard>
            )
          }
          if (r.source_type === 'fee') {
            const c = cardOf(r.source_id)
            const canCount = c && c.waiver_type === 'count' && c.waiver_count && (c.progress_count || 0) < c.waiver_count
            return (
              <ActionCard key={r.id} level={level} icon={<Icon name="card" size={18} />} title={r.title.replace('💳 年费提醒:', '').replace('年费提醒:', '')}
                fact={r.body} action={chip}>
                <div className="flex gap-2 flex-wrap">
                  {canCount && <Btn className="!py-2 !px-3.5 !text-[13px]" onClick={() => addCount(r.source_id)}>记 1 笔进度</Btn>}
                  <Btn ghost className="!py-2 !px-3.5 !text-[13px]" onClick={() => ack(r, 'done')}>处理</Btn>
                  <button className="px-3.5 py-2 text-[13px] text-t3" onClick={() => ack(r, 'dismissed')}>忽略</button>
                </div>
              </ActionCard>
            )
          }
          return (
            <ActionCard key={r.id} level={level} icon={<Icon name="bell" size={18} />} title={r.title} fact={r.body} action={chip}>
              <div className="flex gap-2">
                <Btn ghost className="!py-2 !px-3.5 !text-[13px]" onClick={() => ack(r, 'done')}>处理</Btn>
                <button className="px-3.5 py-2 text-[13px] text-t3" onClick={() => ack(r, 'dismissed')}>忽略</button>
              </div>
            </ActionCard>
          )
        })}

        {!me.snapshotThisMonth && (
          <ActionCard level="habit" icon={<Icon name="camera" size={18} />} title="这个月还没盘点"
            fact="上次录的数字已帮你填好,只改有变化的就行。"
            action={<Btn tone="gold" className="!py-2 !px-3.5 !text-[13px]" onClick={() => nav('/vault?tab=accounts&snap=1')}>30 秒盘点</Btn>} />
        )}
        {me.unseenReports > 0 && latestReport && (
          <ActionCard level="habit" icon={<Icon name="book" size={18} />} title={`上期粮报还没读(${latestReport.period})`}
            fact={latestReport.headline}
            action={<Btn tone="gold" className="!py-2 !px-3.5 !text-[13px]" onClick={() => nav(`/journal/${latestReport.id}`)}>阅读 +5XP</Btn>} />
        )}
        {rest > 0 && <div className="text-center text-xs text-t3 py-1.5">还有 {rest} 件更远期的 · 可在设置里调整提醒阈值</div>}
      </div>

      {/* 本月此时 */}
      <div className="flex items-baseline mt-8 mb-3">
        <h2 className="text-[17px] font-bold">本月此时</h2>
        <button className="ml-auto text-[13px] text-teal-deep font-bold" onClick={() => nav('/vault')}>去财库 ›</button>
      </div>
      <div className="rise sheet-card rounded-[24px] p-4 md:p-5">
        {net && series.length > 1 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-t3">较上月</div>
                <div className="mt-1.5"><Delta value={series[series.length - 1].net - (monthAgo?.net ?? 0)} /></div>
              </div>
              <div>
                <div className="text-[11px] text-t3">30 天内将浪费</div>
                <div className={`num mt-1.5 text-[22px] font-black ${wasted30 > 0 ? 'text-down' : 'text-t3'}`}>{fmtShort(wasted30)}</div>
              </div>
              <div>
                <div className="text-[11px] text-t3">资产 / 负债</div>
                <div className="num mt-1.5 text-[15px] font-black">{fmtShort(series[series.length - 1].assets)}</div>
                <div className="num text-[11px] text-amber-600 font-bold -mt-0.5">{fmtShort(series[series.length - 1].liabilities)}</div>
              </div>
            </div>
            <div className="mt-4"><ScrubChart series={series} height={140} /></div>
          </>
        ) : <div className="text-sm text-t2 py-6 text-center">去财库记下第一次盘点,曲线就会长出来</div>}
      </div>

      {/* 最近一期 */}
      <div className="flex items-baseline mt-8 mb-3">
        <h2 className="text-[17px] font-bold">最近一期</h2>
        {reports.length > 1 && <button className="ml-auto text-[13px] text-teal-deep font-bold" onClick={() => nav('/journal')}>全部期数 ›</button>}
      </div>
      {latestReport ? (
        <button className="rise w-full sheet-card rounded-[24px] p-4 text-left" onClick={() => nav(`/journal/${latestReport.id}`)}>
          <div className="flex items-center gap-2.5">
            <span className="num text-[15px] font-bold">Vol.{latestReport.period}</span>
            {!latestReport.seen && <Chip tone="mint">NEW</Chip>}
            <span className="ml-auto text-t3 text-[13px]">继续读 ›</span>
          </div>
          <div className="text-[13px] text-t2 mt-1 line-clamp-1">{latestReport.headline}</div>
        </button>
      ) : (
        <div className="sheet-card rounded-[24px] p-4 text-[13px] text-t2 rise">第一期粮报将在你完成盘点后的下个月 1 日出刊。</div>
      )}

      {toast && <div className="fixed bottom-[136px] left-1/2 -translate-x-1/2 bg-t1 text-white px-4 py-2.5 rounded-full text-[13px] z-50 shadow-lg">{toast}</div>}
    </div>
  )
}

function fmtShort(n: number) {
  const v = Number(n) || 0
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)} 万`
  return `${Math.round(v)}`
}
