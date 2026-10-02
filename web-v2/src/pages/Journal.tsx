import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, fmtCompact, fmtMoney } from '../api'
import { Chip, Btn, Delta, Empty, ProgressBar, Segmented, Icon } from '../ui'

type Seg = 'issues' | 'trophies'

export default function Journal() {
  const [seg, setSeg] = useState<Seg>('issues')
  const [reports, setReports] = useState<any[]>([])
  const [badges, setBadges] = useState<any>(null)
  useEffect(() => {
    api.get('/api/reports').then(setReports).catch(() => {})
    api.get('/api/badges').then(setBadges).catch(() => {})
  }, [])
  return (
    <div data-testid="journal-page">
      <h1 className="text-[26px] font-black tracking-tight pt-3">报告</h1>
      <p className="text-t2 text-[13px] mt-0.5 mb-4">每月一期粮报,成就随手翻。</p>

      <div className="mb-4">
        <Segmented value={seg} onChange={(v: Seg) => setSeg(v)} options={[
          ['issues', `粮报 ${reports.length}`],
          ['trophies', '成就'],
        ]} />
      </div>

      {seg === 'issues' ? (
        <div className="space-y-3">
          {!reports.length && <Empty icon="❏" text="创刊号要等你记完第一笔快照、跨到下个月 1 日才会印出来" />}
          {reports.map((r, i) => (
            <Link key={r.id} to={`/journal/${r.id}`}
              className="rise flex items-center gap-3 sheet-card rounded-[24px] p-4"
              style={{ animationDelay: `${i * 40}ms` }}>
              <span className="num text-[15px] font-bold whitespace-nowrap">Vol.{r.period}</span>
              {!r.seen && <Chip tone="mint">NEW</Chip>}
              <span className="text-[13px] text-t2 truncate hidden sm:block">{r.headline}</span>
              <span className="ml-auto text-t3 text-[13px] shrink-0">读 ›</span>
            </Link>
          ))}
        </div>
      ) : <TrophyPanel data={badges} />}
    </div>
  )
}

function TrophyPanel({ data }: any) {
  if (!data) return null
  const { badges, level } = data
  const earned = badges.filter((b: any) => b.earned_at)
  const locked = badges.filter((b: any) => !b.earned_at && b.progress)
  const next = [...locked].sort((a, b) => (b.progress.ratio || 0) - (a.progress.ratio || 0))[0]
  const nextPct = level.next ? Math.min(100, ((level.xp - level.min) / (level.next.at - level.min)) * 100) : 100
  const pctText = (b: any) => {
    const p = b.progress
    if (!p) return ''
    const v = Math.max(0, Number(p.value) || 0)
    if (p.target === 0.9) return `${Math.round(v * 100)}% / 90%`
    if (typeof v === 'number' && v >= 10000) return `${fmtCompact(v)} / ${fmtCompact(p.target)}`
    return `${v} / ${p.target}`
  }
  return (
    <div>
      <div className="rise spotlight sheet-card rounded-[24px] p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gold-soft border border-gold/40 grid place-items-center text-2xl shrink-0">🎬</div>
        <div className="min-w-0">
          <div className="font-bold text-[17px]">{level.title}</div>
          <div className="text-xs text-t2 mt-0.5">{level.xp} XP{level.next ? ` · 「${level.next.title}」还差 ${level.next.at - level.xp} XP` : ' · 满级'}</div>
          <ProgressBar pct={nextPct} className="mt-2 max-w-[240px]" />
        </div>
        <div className="ml-auto text-right shrink-0">
          <div className="num text-[22px] font-black text-amber-600">{earned.length}</div>
          <div className="text-[10px] text-t3">/ {badges.length} 枚</div>
        </div>
      </div>

      {next && (
        <div className="mt-3 sheet-card rounded-[24px] p-4 flex items-center gap-3.5">
          <div className="text-3xl grayscale opacity-70">{next.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[15px]">下一枚 · {next.name}</span>
              <Chip tone="gold">{Math.round((next.progress.ratio || 0) * 100)}%</Chip>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <ProgressBar pct={(next.progress.ratio || 0) * 100} className="flex-1" />
              <span className="num text-[11px] text-t2 whitespace-nowrap">{pctText(next)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {badges.map((b: any, i: number) => {
          const got = !!b.earned_at
          const ratio = Math.max(0, Math.min(1, b.progress?.ratio || 0))
          return (
            <div key={b.key}
              className={`rise rounded-[22px] p-3.5 flex flex-col min-h-[148px] ${got ? 'bg-gradient-to-br from-gold-soft/80 to-card border border-gold/25' : 'sheet-card'}`}
              style={{ animationDelay: `${i * 35}ms` }}>
              <div className="flex items-center justify-between">
                <span className={`w-10 h-10 rounded-[13px] grid place-items-center text-xl ${got ? 'bg-gold/15' : 'bg-chip grayscale opacity-70'}`}>{got ? b.icon : '🔒'}</span>
                {got
                  ? <Chip tone="gold">已达成</Chip>
                  : b.progress ? <Chip tone={ratio >= 0.6 ? 'mint' : 'default'}>{Math.round(ratio * 100)}%</Chip> : null}
              </div>
              <div className="mt-2.5 font-bold text-[14px] leading-snug">{b.name}</div>
              <div className="text-[11px] text-t3 mt-1 leading-snug line-clamp-2">{b.desc}</div>
              <div className="mt-auto pt-2.5">
                {got
                  ? <div className="text-[10px] text-amber-600 font-bold num">✓ {b.earned_at}</div>
                  : b.progress
                    ? <>
                      <ProgressBar pct={ratio * 100} />
                      <div className="text-[10px] text-t3 mt-1 num">{pctText(b)}</div>
                    </>
                    : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function JournalDetail() {
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
    }).catch(() => nav('/journal'))
  }, [id])

  if (!r) return <div className="grid place-items-center py-24 text-t3">排印中…</div>
  const d = r.data || {}

  return (
    <div data-testid="journal-detail">
      <button className="text-[13px] text-t2" onClick={() => nav('/journal')}>‹ 全部期数</button>

      <div className="mt-4 spotlight sheet-card rounded-[24px] p-6 text-center">
        <div className="text-t3 text-xs tracking-[0.35em]">VOL.{r.period}</div>
        <h1 className="text-[22px] md:text-[28px] font-black mt-3">{Number(r.period.slice(5, 7))} 月粮报</h1>
        <p className="text-t2 text-[13px] mt-2">{d.headline}</p>
        <div className="mt-5"><Delta value={d.networth?.delta || 0} compact={false} /></div>
        <div className="num text-[34px] font-black mt-1">{fmtCompact(d.networth?.end)}</div>
        <div className="text-xs text-t3 mt-2">
          {fmtCompact(d.networth?.start)} → {fmtCompact(d.networth?.end)}
          {d.networth?.deltaPct != null && <span className="ml-2">({d.networth.deltaPct > 0 ? '+' : ''}{d.networth.deltaPct}%)</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="sheet-card rounded-[24px] p-4">
          <div className="text-[11px] text-t3">资产</div>
          <div className="num text-[17px] font-black mt-1">{fmtCompact(d.networth?.assets)}</div>
        </div>
        <div className="sheet-card rounded-[24px] p-4">
          <div className="text-[11px] text-t3">负债</div>
          <div className="num text-[17px] font-black mt-1 text-amber-600">{fmtCompact(d.networth?.liabilities)}</div>
        </div>
      </div>

      <Panel title="变动最大的账户">
        {!d.movers?.length && <Muted>这个月账户风平浪静。</Muted>}
        {d.movers?.map((m: any) => (
          <div key={m.id} className="flex items-center py-2.5 border-b border-inkline last:border-0 text-sm">
            <span className="font-bold">{m.name}</span>
            <span className="ml-auto"><Delta value={m.delta} ccy={m.currency} /></span>
          </div>
        ))}
      </Panel>

      <Panel title="本月年费">
        {!d.feesPaid?.items?.length && <Muted>本月没有年费被扣,漂亮。</Muted>}
        {d.feesPaid?.total > 0 && <div className="num text-[17px] font-black text-amber-600 mb-1">− {fmtCompact(d.feesPaid.total)}</div>}
        {d.feesPaid?.items?.map((f: any, i: number) => (
          <div key={i} className="flex py-2.5 border-b border-inkline last:border-0 text-sm">
            <span className="font-bold">{f.bank} {f.name}</span>
            <span className="ml-auto">{fmtMoney(f.fee, f.currency)}</span>
          </div>
        ))}
      </Panel>

      <Panel title="本月浪费" red>
        {!d.wasted?.items?.length && <Muted>零浪费——这是本刊最想看到的四个字。</Muted>}
        {d.wasted?.total > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-2">
            <div className="num text-[26px] font-black text-down">{fmtCompact(d.wasted.total)}</div>
            <div className="text-xs text-t2 mt-1">过期作废,无法挽回。下月把它们用在刀刃上。</div>
          </div>
        )}
        {d.wasted?.items?.map((w: any, i: number) => (
          <div key={i} className="flex py-2.5 border-b border-inkline last:border-0 text-sm">
            <span className="font-bold">{w.name}</span>
            <span className="text-[11px] text-t3 ml-2 self-center">{w.expire_date}</span>
            <span className="ml-auto text-down font-bold">{fmtCompact(w.value)}</span>
          </div>
        ))}
      </Panel>

      {d.fxEffect ? (
        <Panel title="汇兑损益">
          <div className="text-sm">汇率波动带来 <Delta value={d.fxEffect} /></div>
        </Panel>
      ) : null}

      <div className="sheet-card rounded-[24px] p-4 mt-3 grid grid-cols-3 text-center">
        <div><div className="text-[11px] text-t3">快照</div><div className="num text-[17px] font-black mt-1">{d.snapshotCount ?? 0}</div></div>
        <div><div className="text-[11px] text-t3">新增卡片</div><div className="num text-[17px] font-black mt-1">{d.cardsAdded ?? 0}</div></div>
        <div><div className="text-[11px] text-t3">解锁徽章</div><div className="num text-[17px] font-black mt-1 text-amber-600">{d.badges?.length ?? 0}</div></div>
      </div>

      <div className="mt-6 text-center text-xs text-t3">— 本期完 ·{r.seen ? ' 已入账 +5 XP' : ''} —</div>
      <div className="mt-4 flex justify-center gap-2 pb-4">
        <Btn ghost onClick={() => nav('/vault')}>去财库</Btn>
        <Btn ghost onClick={() => nav('/')}>回到今天</Btn>
      </div>
    </div>
  )
}

function Panel({ title, children, red }: any) {
  return (
    <div className="sheet-card rounded-[24px] p-5 mt-3">
      <h3 className={`font-bold text-[15px] mb-2 ${red ? 'text-down' : ''}`}>{title}</h3>
      {children}
    </div>
  )
}
const Muted = ({ children }: any) => <div className="text-sm text-t3 py-1">{children}</div>
