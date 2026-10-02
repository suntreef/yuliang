import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, fmtCompact, fmtMoney } from '../api'
import { ReportPoster, Empty, Btn } from '../ui'

export default function Reports() {
  const [reports, setReports] = useState<any[]>([])
  useEffect(() => { api.get('/api/reports').then(setReports).catch(() => {}) }, [])
  return (
    <div className="px-4 md:px-10 py-6" data-testid="reports-page">
      <h1 className="text-xl md:text-2xl font-black mb-1">月报剧场</h1>
      <p className="text-sm text-gray-400 mb-6">每月 1 日自动更新一集,看完攒 XP。</p>
      {!reports.length && <Empty icon="📺" text="第一期月报要在你记录快照后的下个月 1 日生成" />}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {reports.map((r) => <ReportPoster key={r.id} r={r} onClick={null} />)}
      </div>
    </div>
  )
}

export function ReportDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [r, setR] = useState<any>(null)
  useEffect(() => {
    if (!id) return
    api.get(`/api/reports/${id}`).then(async (data) => {
      setR(data)
      if (!data.seen) {
        await api.post(`/api/reports/${id}/seen`, {})
        setR({ ...data, seen: 1 })
      }
    }).catch(() => nav('/reports'))
  }, [id])

  if (!r) return <div className="grid place-items-center py-24 text-gray-500">加载中…</div>
  const d = r.data || {}
  const up = (d.networth?.delta || 0) >= 0

  return (
    <div className="px-4 md:px-10 py-6 max-w-3xl" data-testid="report-detail">
      <Link to="/reports" className="text-xs text-gray-400 hover:text-white">‹ 全部月报</Link>
      <h1 className="text-2xl md:text-3xl font-black mt-2">{r.period} 资产月报</h1>
      <p className="text-sm text-gray-400 mt-1">{d.headline}</p>

      <div className="mt-6 bg-nfx-card rounded-lg p-5">
        <div className="text-xs text-gray-400 mb-1">净资产变化</div>
        <div className={`text-3xl md:text-4xl font-black ${up ? 'text-nfx-red' : 'text-gray-300'}`}>
          {up ? '▲' : '▼'} {fmtCompact(Math.abs(d.networth?.delta || 0))}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          {fmtCompact(d.networth?.start)} → {fmtCompact(d.networth?.end)}
          {d.networth?.deltaPct != null && <span className="ml-2">({d.networth.deltaPct > 0 ? '+' : ''}{d.networth.deltaPct}%)</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-black/25 rounded p-3"><div className="text-xs text-gray-400">资产</div><div className="font-bold mt-1">{fmtCompact(d.networth?.assets)}</div></div>
          <div className="bg-black/25 rounded p-3"><div className="text-xs text-gray-400">负债</div><div className="font-bold mt-1 text-orange-400">{fmtCompact(d.networth?.liabilities)}</div></div>
        </div>
      </div>

      <Section title="变动最大的账户 Top3">
        {!d.movers?.length && <Muted>本月账户没有变化。</Muted>}
        {d.movers?.map((m: any) => (
          <div key={m.id} className="flex items-center py-2 border-b border-white/5 text-sm">
            <span className="mr-2">{m.type === 'liability' ? '🏠' : '📈'}</span>
            <span className="font-bold">{m.name}</span>
            <span className={`ml-auto font-black ${m.delta >= 0 ? 'text-nfx-red' : 'text-emerald-400'}`}>
              {m.delta >= 0 ? '+' : ''}{fmtCompact(m.delta, m.currency)}
            </span>
          </div>
        ))}
      </Section>

      <Section title="本月年费">
        {!d.feesPaid?.items?.length && <Muted>本月没有扣收年费,漂亮。</Muted>}
        {d.feesPaid?.total > 0 && (
          <div className="text-lg font-black text-orange-400 mb-2">共 {fmtCompact(d.feesPaid.total)}</div>
        )}
        {d.feesPaid?.items?.map((f: any, i: number) => (
          <div key={i} className="flex py-2 border-b border-white/5 text-sm">
            <span className="font-bold">💳 {f.bank} {f.name}</span>
            <span className="ml-auto">{fmtMoney(f.fee, f.currency)}</span>
          </div>
        ))}
      </Section>

      <Section title="本月浪费(过期作废的权益)">
        {!d.wasted?.items?.length && <Muted>零浪费,这就是理财剧的爽点 🎉</Muted>}
        {d.wasted?.total > 0 && <div className="text-lg font-black text-nfx-red mb-2">浪费 {fmtCompact(d.wasted.total)} —— 下月把它们用掉!</div>}
        {d.wasted?.items?.map((w: any, i: number) => (
          <div key={i} className="flex py-2 border-b border-white/5 text-sm">
            <span className="font-bold">🎁 {w.name}</span>
            <span className="text-gray-500 text-xs ml-2 self-center">{w.expire_date} 过期</span>
            <span className="ml-auto text-nfx-red">{fmtCompact(w.value)}</span>
          </div>
        ))}
      </Section>

      {d.fxEffect ? (
        <Section title="汇兑损益">
          <div className="text-sm">因汇率波动,外币资产折算变化 <b className={d.fxEffect >= 0 ? 'text-nfx-red' : 'text-emerald-400'}>{d.fxEffect >= 0 ? '+' : ''}{fmtCompact(d.fxEffect)}</b></div>
        </Section>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="bg-nfx-card rounded-lg p-3"><div className="text-xs text-gray-400">快照次数</div><div className="text-xl font-black mt-1">{d.snapshotCount ?? 0}</div></div>
        <div className="bg-nfx-card rounded-lg p-3"><div className="text-xs text-gray-400">新增卡片</div><div className="text-xl font-black mt-1">{d.cardsAdded ?? 0}</div></div>
        <div className="bg-nfx-card rounded-lg p-3"><div className="text-xs text-gray-400">解锁徽章</div><div className="text-xl font-black mt-1">{d.badges?.length ?? 0}</div></div>
      </div>

      <div className="mt-8 flex gap-2">
        <Btn onClick={() => nav('/assets')}>去记录这个月</Btn>
        <Btn ghost onClick={() => nav('/')}>回到首页</Btn>
      </div>
    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <div className="mt-6 bg-nfx-card rounded-lg p-5">
      <h3 className="font-bold mb-2">{title}</h3>
      {children}
    </div>
  )
}
const Muted = ({ children }: any) => <div className="text-sm text-gray-500 py-1">{children}</div>
