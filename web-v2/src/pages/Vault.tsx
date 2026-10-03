import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { api, fmtCompact, fmtMoney, daysUntil, todayStr } from '../api'
import { Btn, Chip, Field, inputCls, Sheet, ProgressBar, Empty, Icon, Segmented } from '../ui'

const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD']
const WAIVER_LABEL: any = { none: '无免年费条件', count: '按笔数免年费', amount: '按金额免年费', rigid: '刚性年费' }
const TYPE_META: any = { cash: ['🪙', '现金'], bank: ['🏦', '储蓄'], invest: ['📈', '投资'], pension: ['🧧', '公积金'], points: ['🎁', '积分'], liability: ['🏠', '负债'] }
const hashHue = (s: string) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }

type Seg = 'cards' | 'accounts' | 'goals'

export default function Vault() {
  const [sp, setSp] = useSearchParams()
  const [seg, setSeg] = useState<Seg>((sp.get('tab') as Seg) || 'cards')
  const [cards, setCards] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [sheet, setSheet] = useState<'' | 'addCard' | 'editCard' | 'addAccount' | 'editAccount' | 'snap' | 'import' | 'goal'>('')
  const [editItem, setEditItem] = useState<any>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    api.get('/api/cards').then(setCards).catch(() => {})
    api.get('/api/benefits').then(setBenefits).catch(() => {})
    api.get('/api/accounts').then(setAccounts).catch(() => {})
    api.get('/api/goals').then(setGoals).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (sp.get('snap') === '1') { setSheet('snap'); sp.delete('snap'); setSp(sp, { replace: true }) } }, [])

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2000) }
  const active = accounts.filter((a) => !a.archived)

  const fab = seg === 'cards' ? { label: '添加卡片', act: () => { setEditItem(null); setSheet('addCard') } }
    : seg === 'accounts' ? { label: '开始盘点', act: () => setSheet('snap') }
      : { label: '新目标', act: () => setSheet('goal') }

  return (
    <div data-testid="vault-page" className="pb-6">
      <h1 className="text-[26px] font-black tracking-tight pt-3">财库</h1>
      <p className="text-t2 text-[13px] mt-0.5 mb-4">卡、账户、目标,都在这一个屋里。</p>

      {/* 分段器 */}
      <div className="mb-4">
        <Segmented value={seg} onChange={(v: Seg) => setSeg(v)} options={[
          ['cards', `卡片 ${cards.filter((c) => !c.archived).length}`],
          ['accounts', `账户 ${active.length}`],
          ['goals', `目标 ${goals.filter((g) => !g.done).length}`],
        ]} />
      </div>

      {/* ---------- 卡片段 ---------- */}
      {seg === 'cards' && (
        <div className="space-y-4">
          {cards.filter((c) => !c.archived).map((c, i) => (
            <div key={c.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
              <CardFace card={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onEdit={() => { setEditItem(c); setSheet('editCard') }} />
              <div className={`acc ${openId === c.id ? 'open' : ''}`}>
                <div>
                  <div className="bg-card border border-t-0 border-inkline rounded-b-[20px] -mt-1 shadow-sm">
                    <CardPanel card={c} benefits={benefits.filter((b) => b.card_id === c.id && !b.archived)} onChanged={load} onFlash={flash} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!cards.length && <Empty icon="💳" text="第一张卡:点右下角添加" />}
        </div>
      )}

      {/* ---------- 账户段 ---------- */}
      {seg === 'accounts' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Btn ghost className="!py-2 !px-3.5 !text-[13px]" onClick={() => setSheet('import')}>导入 CSV</Btn>
            <Btn ghost className="!py-2 !px-3.5 !text-[13px]" onClick={() => { setEditItem(null); setSheet('addAccount') }}>添加账户</Btn>
          </div>
          <AccGroup title="资产" list={active.filter((a) => a.type !== 'liability')} onEdit={(a: any) => { setEditItem(a); setSheet('editAccount') }} />
          <AccGroup title="负债" list={active.filter((a) => a.type === 'liability')} warn onEdit={(a: any) => { setEditItem(a); setSheet('editAccount') }} />
        </div>
      )}

      {/* ---------- 目标段 ---------- */}
      {seg === 'goals' && (
        <div className="space-y-3">
          {!goals.length && <Empty icon="🎯" text="立一个目标,「今天」页会帮你盯着它" />}
          {goals.map((g, i) => {
            const p = Math.max(0, Math.min(100, ((g.current_amount || 0) / g.target_amount) * 100))
            return (
              <div key={g.id} className="rise sheet-card rounded-[24px] p-4" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-chip grid place-items-center text-teal-deep shrink-0"><Icon name="target" size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-[15px] truncate">{g.name}</span>
                      {g.done ? <Chip tone="mint">达成</Chip> : null}
                    </div>
                    <div className="text-[11px] text-t3 mt-0.5">{g.due_date ? `截止 ${g.due_date}` : '不设截止,按自己的节奏'}</div>
                  </div>
                  <button aria-label="删除目标" className="btn-press w-8 h-8 rounded-full grid place-items-center text-t3 hover:text-down hover:bg-chip shrink-0"
                    onClick={async () => { await api.del(`/api/goals/${g.id}`); load() }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                <div className="mt-3"><ProgressBar pct={p} /></div>
                <div className="flex justify-between mt-2 text-xs num text-t2">
                  <span>{fmtCompact(g.current_amount, g.currency)}</span>
                  <span>{Math.round(p)}% · 目标 {fmtCompact(g.target_amount, g.currency)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 情境感知 FAB:Portal 渲染到 body,脱离页面切换动画容器,不再漂移 */}
      {createPortal(
        <button onClick={fab.act}
          className="btn-press fixed bottom-[118px] right-4 z-40 h-[52px] pl-5 pr-6 rounded-full text-white font-bold text-[15px] flex items-center gap-2"
          style={{ background: 'var(--g-brand)', boxShadow: '0 12px 28px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)' }}>
          <Icon name="plus" size={17} strokeWidth={2.4} />{fab.label}
        </button>,
        document.body,
      )}

      <Sheet open={sheet === 'addCard' || sheet === 'editCard'} onClose={() => setSheet('')} title={sheet === 'editCard' ? '编辑卡片' : '添加信用卡'}>
        <CardForm card={sheet === 'editCard' ? editItem : null} onCancel={() => setSheet('')} onSaved={() => { setSheet(''); load() }} />
      </Sheet>
      <Sheet open={sheet === 'addAccount' || sheet === 'editAccount'} onClose={() => setSheet('')} title={sheet === 'editAccount' ? '编辑账户' : '添加账户'}>
        <AccountForm account={sheet === 'editAccount' ? editItem : null} onCancel={() => setSheet('')} onSaved={() => { setSheet(''); load() }} />
      </Sheet>
      <Sheet open={sheet === 'snap'} onClose={() => setSheet('')} title="30 秒盘点" wide>
        <SnapshotForm accounts={active} onCancel={() => setSheet('')} onSaved={() => { setSheet(''); load() }} />
      </Sheet>
      <Sheet open={sheet === 'import'} onClose={() => setSheet('')} title="CSV 导入" wide>
        <ImportForm onCancel={() => setSheet('')} onSaved={() => { setSheet(''); load() }} />
      </Sheet>
      <Sheet open={sheet === 'goal'} onClose={() => setSheet('')} title="立个目标">
        <GoalForm onCancel={() => setSheet('')} onSaved={() => { setSheet(''); load() }} />
      </Sheet>
      {toast && <div className="fixed bottom-[136px] left-1/2 -translate-x-1/2 bg-t1 text-white px-4 py-2.5 rounded-full text-[13px] z-50 shadow-lg">{toast}</div>}
    </div>
  )
}

function AccGroup({ title, list, warn, onEdit }: any) {
  const total = list.reduce((s: number, a: any) => s + (a.value_base || 0), 0)
  return (
    <div>
      <div className="flex items-baseline mb-2">
        <span className="text-[13px] text-t3">{title}</span>
        <span className={`num ml-auto text-[15px] font-bold ${warn ? 'text-amber-600' : ''}`}>{fmtCompact(total)}</span>
      </div>
      {!list.length && <div className="text-xs text-t3 py-2">暂无</div>}
      <div className="sheet-card rounded-[24px] divide-y divide-inkline">
        {list.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-10 h-10 rounded-[14px] bg-chip grid place-items-center text-[15px] shrink-0">{TYPE_META[a.type]?.[0] || '💼'}</span>
            <div className="min-w-0">
              <div className="text-[15px] font-bold truncate">{a.name}</div>
              <div className="text-[11px] text-t3">{a.institution || TYPE_META[a.type]?.[1]} · {a.latest_date || '未记录'}</div>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-chip text-t2 shrink-0">{a.currency}</span>
            <div className="num ml-auto text-[15px] font-bold shrink-0">{a.latest_value != null ? fmtCompact(a.latest_value, a.currency) : '—'}</div>
            <button className="text-xs text-t3 shrink-0" onClick={() => onEdit(a)}>编辑</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CardFace({ card, open, onToggle, onEdit }: any) {
  const h = hashHue(card.bank)
  const d = daysUntil(card.next_fee_date)
  const met = (card.waiver_type === 'count' && card.waiver_count && (card.progress_count || 0) >= card.waiver_count)
    || (card.waiver_type === 'amount' && card.waiver_amount && (card.progress_amount || 0) >= card.waiver_amount)
  return (
    <div>
      <div onClick={onToggle} className="cursor-pointer rounded-[24px] overflow-hidden border border-black/10 shadow-md"
        style={{ aspectRatio: '1.586', background: `linear-gradient(150deg, hsl(${h},42%,30%) 0%, hsl(${(h + 40) % 360},48%,14%) 100%)` }}>
        <div className="h-full p-4 md:p-5 flex flex-col text-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest opacity-90">{card.bank}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30">{card.currency}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {met && <Chip tone="mint">免年费 ✓</Chip>}
              {!met && (card.waiver_type === 'count' || card.waiver_type === 'amount') && <Chip tone="default">进行中</Chip>}
              {d != null && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${d <= 7 ? 'bg-urgent' : d <= 30 ? 'bg-amber-500' : 'bg-black/30'}`}>{d <= 0 ? '年费今天' : `年费 ${d} 天`}</span>}
            </span>
          </div>
          <div className="mt-auto">
            <div className="font-bold text-[17px]">{card.name}</div>
            <div className="flex items-end justify-between mt-0.5">
              <span className="text-xs opacity-75">年费 {fmtMoney(card.annual_fee, card.currency)}</span>
              <span className="text-[10px] opacity-70">{open ? '收起 ▲' : '展开 ▼'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardPanel({ card, benefits, onChanged, onFlash }: any) {
  const [cnt, setCnt] = useState('1')
  const [amt, setAmt] = useState('')
  const [addB, setAddB] = useState(false)
  const d = daysUntil(card.next_fee_date)
  const addProgress = async () => {
    try {
      await api.post(`/api/cards/${card.id}/progress`, { add_count: Number(cnt) || 0, add_amount: Number(amt) || 0 })
      setAmt(''); onFlash('进度已更新'); onChanged()
    } catch (e: any) { onFlash(e.message) }
  }
  const useBenefit = async (b: any) => {
    try {
      await api.post(`/api/benefits/${b.id}/use`, {})
      onFlash(`已用「${b.name}」,+3 XP`); onChanged()
    } catch (e: any) { onFlash(e.message) }
  }
  const met = (card.waiver_type === 'count' && card.waiver_count && (card.progress_count || 0) >= card.waiver_count)
    || (card.waiver_type === 'amount' && card.waiver_amount && (card.progress_amount || 0) >= card.waiver_amount)
  const feePct = d != null && d <= 60 ? Math.max(0, Math.min(100, ((60 - d) / 60) * 100)) : 0
  const wpct = card.waiver_type === 'count' && card.waiver_count ? ((card.progress_count || 0) / card.waiver_count) * 100
    : card.waiver_amount ? ((card.progress_amount || 0) / card.waiver_amount) * 100 : 0

  return (
    <div className="p-4 md:p-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] text-t3 mb-1.5">下次扣费 {card.next_fee_date || '未设置'}{d != null && ` · ${d <= 0 ? '今天' : `${d} 天后`}`}</div>
          <ProgressBar pct={feePct} />
        </div>
        <div>
          <div className="text-[11px] text-t3 mb-1.5">{WAIVER_LABEL[card.waiver_type]}{met && <span className="text-up font-bold ml-1.5">✓ 已达成</span>}</div>
          {(card.waiver_type === 'count' || card.waiver_type === 'amount') && (
            <div className="flex items-center gap-2">
              <div className="flex-1"><ProgressBar pct={wpct} /></div>
              {card.waiver_type === 'count' && (
                <>
                  <input className={inputCls + ' !w-14 !py-1.5 text-center'} type="number" min="1" value={cnt} onChange={(e) => setCnt(e.target.value)} />
                  <Btn className="!py-1.5 !px-3 !text-[13px]" onClick={addProgress}>记{cnt}笔</Btn>
                </>
              )}
              {card.waiver_type === 'amount' && (
                <>
                  <input className={inputCls + ' !w-24 !py-1.5'} type="number" placeholder="金额" value={amt} onChange={(e) => setAmt(e.target.value)} />
                  <Btn className="!py-1.5 !px-3 !text-[13px]" onClick={addProgress}>记</Btn>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {card.notes && <div className="text-xs text-t2 mt-4">📝 {card.notes}</div>}

      <div className="mt-5">
        <div className="flex items-center mb-2">
          <span className="text-[13px] text-t3">权益({benefits.length})</span>
          <button className="ml-auto text-xs text-teal-deep font-bold" onClick={() => setAddB(!addB)}>{addB ? '收起' : '+ 添加权益'}</button>
        </div>
        {addB && (
          <div className="bg-slate-50 rounded-2xl p-3.5 mb-3">
            <BenefitForm cardId={card.id} onCancel={() => setAddB(false)} onSaved={() => { setAddB(false); onChanged() }} />
          </div>
        )}
        {!benefits.length && <div className="text-xs text-t3 py-2">贵宾厅、代驾、视频会员都可以记在这里。</div>}
        {benefits.map((b) => {
          const maxed = b.type === 'count' && b.total_count != null && (b.used_count || 0) >= b.total_count
          const bd = daysUntil(b.expire_date)
          return (
            <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-inkline last:border-0">
              <button onClick={() => !maxed && useBenefit(b)} disabled={maxed} aria-label="用掉一次"
                className={`w-7 h-7 rounded-lg border grid place-items-center text-xs shrink-0 transition-colors ${maxed ? 'bg-up/10 border-up/40 text-up' : 'border-slate-300 hover:border-up hover:text-up'}`}>
                {maxed ? '✓' : ''}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{b.name}</div>
                <div className="text-[11px] text-t3">
                  {b.type === 'count' ? `已用 ${b.used_count || 0}/${b.total_count ?? '∞'}` : b.type === 'amount' ? '金额型' : '日期型'}
                  {b.value ? ` · 价值 ${fmtMoney(b.value, b.currency)}` : ''}{b.expire_date ? ` · ${b.expire_date} 到期` : ''}
                </div>
              </div>
              {bd != null && <Chip tone={bd <= 7 ? 'red' : bd <= 30 ? 'amber' : 'default'}>{bd} 天</Chip>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CardForm({ card, onCancel, onSaved }: any) {
  const [f, setF] = useState<any>(card ? { ...card } : { bank: '', name: '', currency: 'CNY', annual_fee: '', fee_month: '', fee_day: '', waiver_type: 'none', waiver_count: '', waiver_amount: '', notes: '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try {
      if (card) await api.put(`/api/cards/${card.id}`, f)
      else await api.post('/api/cards', f)
      onSaved()
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="银行"><input className={inputCls} value={f.bank} onChange={set('bank')} placeholder="招商银行 / Chase" /></Field>
        <Field label="卡名(可用别名)"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="白金主卡" /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="年费金额"><input className={inputCls} type="number" value={f.annual_fee ?? ''} onChange={set('annual_fee')} /></Field>
        <Field label="扣费月(1-12)"><input className={inputCls} type="number" min="1" max="12" value={f.fee_month ?? ''} onChange={set('fee_month')} /></Field>
        <Field label="扣费日(1-28)"><input className={inputCls} type="number" min="1" max="28" value={f.fee_day ?? ''} onChange={set('fee_day')} /></Field>
        <Field label="免年费方式">
          <select className={inputCls} value={f.waiver_type} onChange={set('waiver_type')}>
            <option value="none">无(刚性)</option><option value="count">按笔数</option><option value="amount">按金额</option><option value="rigid">刚性年费</option>
          </select>
        </Field>
        {f.waiver_type === 'count' && <Field label="免年费需要笔数"><input className={inputCls} type="number" value={f.waiver_count ?? ''} onChange={set('waiver_count')} /></Field>}
        {f.waiver_type === 'amount' && <Field label="免年费需要金额"><input className={inputCls} type="number" value={f.waiver_amount ?? ''} onChange={set('waiver_amount')} /></Field>}
        <div className="col-span-2"><Field label="备注"><input className={inputCls} value={f.notes || ''} onChange={set('notes')} /></Field></div>
      </div>
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      <div className="flex gap-2"><Btn onClick={save}>保存</Btn><Btn ghost onClick={onCancel}>取消</Btn></div>
    </div>
  )
}

function BenefitForm({ cardId, onCancel, onSaved }: any) {
  const [f, setF] = useState<any>({ card_id: cardId || '', name: '', type: 'count', total_count: '', value: '', currency: 'CNY', expire_date: '', notes: '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try { await api.post('/api/benefits', f); onSaved() } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3">
        <div className="col-span-2"><Field label="权益名称"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="机场贵宾厅" /></Field></div>
        <Field label="类型">
          <select className={inputCls} value={f.type} onChange={set('type')}>
            <option value="count">次数型</option><option value="date">日期型</option><option value="amount">金额型</option>
          </select>
        </Field>
        {f.type === 'count' && <Field label="每年次数"><input className={inputCls} type="number" value={f.total_count} onChange={set('total_count')} /></Field>}
        <Field label="价值(估算)"><input className={inputCls} type="number" value={f.value} onChange={set('value')} /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="col-span-2"><Field label="到期日"><input className={inputCls} type="date" value={f.expire_date} onChange={set('expire_date')} /></Field></div>
      </div>
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      <div className="flex gap-2"><Btn onClick={save}>保存权益</Btn><Btn ghost onClick={onCancel}>取消</Btn></div>
    </div>
  )
}

function AccountForm({ account, onCancel, onSaved }: any) {
  const [f, setF] = useState<any>(account ? { ...account } : { name: '', type: 'bank', currency: 'CNY', institution: '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try {
      if (account) await api.put(`/api/accounts/${account.id}`, f)
      else await api.post('/api/accounts', f)
      onSaved()
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <Field label="账户名"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="招商储蓄" /></Field>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="类型">
          <select className={inputCls} value={f.type} onChange={set('type')}>
            {Object.entries(TYPE_META).map(([k, v]: any) => <option key={k} value={k}>{v[1]}</option>)}
          </select>
        </Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="机构(可选)"><input className={inputCls} value={f.institution || ''} onChange={set('institution')} /></Field>
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      <div className="flex gap-2">
        <Btn onClick={save}>保存</Btn>
        <Btn ghost onClick={onCancel}>取消</Btn>
        {account && <Btn ghost className="ml-auto !bg-chip !text-t3" onClick={async () => { await api.del(`/api/accounts/${account.id}`); onSaved() }}>归档</Btn>}
      </div>
    </div>
  )
}

function SnapshotForm({ accounts, onCancel, onSaved }: any) {
  const [date, setDate] = useState(todayStr())
  const [values, setValues] = useState<any>({})
  const [prefill, setPrefill] = useState<any>({})
  const [err, setErr] = useState('')
  useEffect(() => {
    api.get('/api/snapshots/latest').then((r) => {
      const map: any = {}
      for (const e of r.entries) map[e.account_id] = String(e.value)
      setPrefill(map); setValues(map)
    }).catch(() => setValues({}))
  }, [])
  const save = async () => {
    setErr('')
    const entries = accounts
      .filter((a: any) => values[a.id] !== undefined && values[a.id] !== '' && Number.isFinite(Number(values[a.id])))
      .map((a: any) => ({ account_id: a.id, value: Number(values[a.id]) }))
    if (!entries.length) { setErr('至少填写一个账户余额'); return }
    try { await api.post('/api/snapshots/bulk', { date, entries }); onSaved() } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <Field label="快照日期"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="text-xs text-t3 mb-2">上次的数字已预填,只改有变化的就行。</div>
      {!accounts.length && <Empty icon="💼" text="先添加账户,或用 CSV 导入" />}
      <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
        {accounts.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3">
            <div className="w-20 sm:w-32 shrink-0 text-sm truncate">{TYPE_META[a.type]?.[0]} {a.name}</div>
            <span className="text-[10px] text-t3 w-8">{a.currency}</span>
            <input className={inputCls} type="number" step="any" placeholder={String(prefill[a.id] ?? '')}
              value={values[a.id] ?? ''} onChange={(e) => setValues({ ...values, [a.id]: e.target.value })} />
          </div>
        ))}
      </div>
      {err && <div className="text-down text-sm mt-3">{err}</div>}
      <Btn className="w-full py-3 mt-4" onClick={save}>保存盘点 +10XP</Btn>
    </div>
  )
}

function ImportForm({ onCancel, onSaved }: any) {
  const [date, setDate] = useState(todayStr())
  const [csv, setCsv] = useState('')
  const [msg, setMsg] = useState<any>(null)
  const [err, setErr] = useState('')
  const save = async () => {
    setErr(''); setMsg(null)
    try { const r = await api.post('/api/import/snapshots', { date, csv }); setMsg(r); setTimeout(onSaved, 1200) } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <Field label="快照日期"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="每行:账户名,余额,币种(可选),类型(可选)">
        <textarea className={inputCls + ' font-mono text-xs h-36'} value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder={'招商储蓄,120000,CNY,bank\n美股券商,8500,USD,invest\n房贷,890000,CNY,liability'} />
      </Field>
      <div className="text-xs text-t3 mb-3">类型:cash / bank / invest / pension / points / liability,不存在的账户自动创建。</div>
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      {msg && <div className="text-up text-sm mb-2">已导入 {msg.imported} 条,新建账户 {msg.createdAccounts} 个。</div>}
      <Btn className="w-full py-3" onClick={save}>导入</Btn>
    </div>
  )
}

function GoalForm({ onCancel, onSaved }: any) {
  const [f, setF] = useState<any>({ name: '', kind: 'networth', target_amount: '', current_amount: '', currency: 'CNY', due_date: '' })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    try { await api.post('/api/goals', f); onSaved() } catch (e: any) { setErr(e.message) }
  }
  return (
    <div>
      <Field label="目标名"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="净资产 50 万" /></Field>
      <Field label="类型">
        <select className={inputCls} value={f.kind} onChange={set('kind')}>
          <option value="networth">跟随净资产(自动更新进度)</option>
          <option value="manual">手动更新进度</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="目标金额"><input className={inputCls} type="number" value={f.target_amount} onChange={set('target_amount')} /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {f.kind === 'manual' && <Field label="当前金额"><input className={inputCls} type="number" value={f.current_amount} onChange={set('current_amount')} /></Field>}
        <Field label="截止日期(可选)"><input className={inputCls} type="date" value={f.due_date} onChange={set('due_date')} /></Field>
      </div>
      {err && <div className="text-down text-sm mb-2">{err}</div>}
      <Btn className="w-full py-3" onClick={save}>立目标</Btn>
    </div>
  )
}
