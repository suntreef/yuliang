import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useApp, bus } from '../App'
import { Row, ReportPoster, ReminderCard, BenefitPoster, CardPoster, GoalPoster, BadgePoster, AccountPoster, Empty } from '../ui'

export default function Home() {
  const { me } = useApp()
  const nav = useNavigate()
  const [reminders, setReminders] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])

  const load = useCallback(() => {
    api.get('/api/reminders?status=pending').then(setReminders).catch(() => {})
    api.get('/api/reports').then(setReports).catch(() => {})
    api.get('/api/cards').then(setCards).catch(() => {})
    api.get('/api/benefits').then(setBenefits).catch(() => {})
    api.get('/api/goals').then(setGoals).catch(() => {})
    api.get('/api/badges').then((b) => setBadges(b.badges)).catch(() => {})
    api.get('/api/accounts').then(setAccounts).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const onAck = async (r: any, action: string) => {
    await api.post(`/api/reminders/${r.id}/ack`, { action })
    setReminders((rs) => rs.filter((x) => x.id !== r.id))
    bus.fire('af:reminders-changed')
  }

  const unseen = reports.filter((r) => !r.seen)
  const hero = unseen[0] || reports[0] || null
  const expiring = benefits.filter((b) => !b.archived && b.expire_date).slice(0, 20)
  const activeCards = cards.filter((c) => !c.archived)
  const activeGoals = goals.filter((g) => !g.done)
  const earned = badges.filter((b) => b.earned_at)
  const activeAccounts = accounts.filter((a) => !a.archived)

  return (
    <div data-testid="home">
      {/* ---------- Hero 大横幅 ---------- */}
      <section className="relative">
        <div className="relative h-[44vh] min-h-[320px] md:h-[54vh] md:min-h-[420px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(229,9,20,0.22),transparent_55%),radial-gradient(ellipse_at_20%_90%,rgba(229,9,20,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-nfx-dark to-transparent" />
          <div className="relative h-full flex flex-col justify-end px-4 md:px-10 pb-8 max-w-[760px]">
            <div className="text-[11px] md:text-xs text-gray-300 tracking-[0.3em] mb-2">ASSETFLIX 剧场 · {me.level.title} 第 {me.streak || 0} 月在追</div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight">
              {hero ? `${hero.period} 资产月报` : '欢迎来到你的资产剧场'}
            </h1>
            <p className="mt-2 text-sm md:text-base text-gray-300 line-clamp-2">
              {hero ? hero.headline : '记录第一笔资产快照,之后每个月都会为你更新一「集」总结。'}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                className="bg-white text-black font-bold px-5 py-2.5 rounded hover:bg-white/85 text-sm md:text-base"
                onClick={() => (hero ? nav(`/reports/${hero.id}`) : nav('/assets'))}>
                ▶ {hero ? '立即查看' : '去记录快照'}
              </button>
              {me.pendingReminders > 0 && (
                <button className="bg-white/20 backdrop-blur font-bold px-5 py-2.5 rounded hover:bg-white/30 text-sm md:text-base"
                  onClick={() => document.getElementById('row-continue')?.scrollIntoView({ behavior: 'smooth' })}>
                  🔔 {me.pendingReminders} 条待办
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 横向滚动行 ---------- */}
      <div className="-mt-2 relative z-10">
        <Row title="继续观看">
          {unseen.map((r) => <ReportPoster key={'r' + r.id} r={r} onClick={() => nav(`/reports/${r.id}`)} />)}
          {reminders.map((r) => <ReminderCard key={'k' + r.id} r={r} onAck={onAck} />)}
          {!unseen.length && !reminders.length && (
            <div className="text-sm text-gray-500 py-6">都看完啦,追剧愉快 🍿</div>
          )}
        </Row>

        <Row title="即将下架 · 权益到期" to="/cards">
          {expiring.map((b) => <BenefitPoster key={b.id} b={b} onClick={() => nav('/cards')} />)}
        </Row>

        <Row title="我的卡包" to="/cards">
          {activeCards.map((c) => <CardPoster key={c.id} card={c} onClick={() => nav('/cards')} />)}
          {!activeCards.length && <Empty icon="💳" text="还没有信用卡,去卡包添加" />}
        </Row>

        <Row title="正在追" to="/assets">
          {activeGoals.map((g) => <GoalPoster key={g.id} g={g} onClick={() => nav('/assets')} />)}
        </Row>

        <Row title="成就墙" to="/achievements">
          {badges.map((b) => <BadgePoster key={b.key} badge={b} />)}
          {!badges.length && <Empty icon="🏆" text="徽章还没发放,先去记录一笔" />}
        </Row>

        <Row title="资产档案" to="/assets">
          {activeAccounts.map((a) => <AccountPoster key={a.id} a={a} onClick={() => nav('/assets')} />)}
          {!activeAccounts.length && <Empty icon="💼" text="还没有账户,去资产页添加" />}
        </Row>
      </div>
    </div>
  )
}
