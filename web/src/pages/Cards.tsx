import React, { useCallback, useEffect, useState } from 'react'
import { api, fmtMoney, daysUntil } from '../api'
import { bus } from '../App'
import { Modal, Field, Btn, inputCls, ProgressBar, waiverPct, Empty } from '../ui'

const CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD']
const WAIVER_LABEL: any = { none: '无免年费条件', count: '按笔数免年费', amount: '按金额免年费', rigid: '刚性年费' }

export default function Cards() {
  const [cards, setCards] = useState<any[]>([])
  const [benefits, setBenefits] = useState<any[]>([])
  const [detailId, setDetailId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.get('/api/cards').then(setCards).catch(() => {})
    api.get('/api/benefits').then(setBenefits).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const detail = cards.find((c) => c.id === detailId) || null
  const cardBenefits = (cid: number) => benefits.filter((b) => b.card_id === cid && !b.archived)

  return (
    <div className="px-4 md:px-10 py-6" data-testid="cards-page">
      <h1 className="text-xl md:text-2xl font-black mb-1">我的卡包</h1>
      <p className="text-sm text-gray-400 mb-6">年费倒计时、免年费进度、权益台账,都在每张"海报"里。</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {cards.map((c) => (
          <CardTile key={c.id} card={c} onClick={() => setDetailId(c.id)} />
        ))}
        <button onClick={() => setShowAdd(true)} data-testid="add-card"
          className="card-hover shrink-0 aspect-[2/3] rounded-md border-2 border-dashed border-white/20 hover:border-nfx-red grid place-items-center text-gray-500 hover:text-white">
          <div className="text-center"><div className="text-4xl">＋</div><div className="text-xs mt-2">添加信用卡</div></div>
        </button>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="添加信用卡">
        <CardForm onCancel={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      </Modal>
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.bank} · ${detail.name}` : ''} wide>
        {detail && (
          <CardDetail card={detail} benefits={cardBenefits(detail.id)} onChanged={load}
            onErr={setErr} onClose={() => setDetailId(null)} />
        )}
      </Modal>
      {err && <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-nfx-red px-4 py-2 rounded text-sm z-50">{err}</div>}
    </div>
  )
}

function CardTile({ card, onClick }: any) {
  const d = daysUntil(card.next_fee_date)
  return (
    <div onClick={onClick} data-testid={`card-${card.name}`}
      className="card-hover relative aspect-[2/3] rounded-md overflow-hidden cursor-pointer"
      style={{ background: `linear-gradient(160deg, hsl(${hashHue(card.bank)},45%,26%), hsl(${(hashHue(card.bank) + 40) % 360},55%,10%))` }}>
      {card.archived ? <span className="absolute top-2 left-2 z-10 bg-black/70 text-[10px] px-1.5 py-0.5 rounded">已归档</span>
        : d != null && (
          <span className={`absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded font-bold ${d <= 1 ? 'bg-nfx-red' : d <= 7 ? 'bg-orange-500' : d <= 30 ? 'bg-yellow-600/90' : 'bg-black/70 text-gray-300'}`}>
            年费 {d <= 0 ? '今天' : `${d}天`}
          </span>
        )}
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
    </div>
  )
}

function hashHue(s: string) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }

function CardDetail({ card, benefits, onChanged, onErr, onClose }: any) {
  const [editing, setEditing] = useState(false)
  const [addBenefit, setAddBenefit] = useState(false)
  const [cnt, setCnt] = useState('1')
  const [amt, setAmt] = useState('')
  const d = daysUntil(card.next_fee_date)

  const addProgress = async () => {
    try {
      await api.post(`/api/cards/${card.id}/progress`, { add_count: Number(cnt) || 0, add_amount: Number(amt) || 0 })
      setAmt('')
      onChanged()
    } catch (e: any) { onErr(e.message) }
  }
  const useBenefit = async (b: any) => {
    try {
      await api.post(`/api/benefits/${b.id}/use`, {})
      onChanged()
    } catch (e: any) { onErr(e.message) }
  }
  const archive = async () => {
    await api.del(`/api/cards/${card.id}`)
    onClose(); onChanged()
  }
  const met = (card.waiver_type === 'count' && card.waiver_count && (card.progress_count || 0) >= card.waiver_count)
    || (card.waiver_type === 'amount' && card.waiver_amount && (card.progress_amount || 0) >= card.waiver_amount)

  return (
    <div>
      {editing ? (
        <CardForm card={card} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-black/30 rounded p-3"><div className="text-xs text-gray-400">年费</div><div className="font-bold text-base mt-1">{fmtMoney(card.annual_fee, card.currency)}</div></div>
            <div className="bg-black/30 rounded p-3"><div className="text-xs text-gray-400">下次扣费日</div><div className="font-bold text-base mt-1">{card.next_fee_date || '未设置'}{d != null && <span className="text-xs text-gray-400 ml-1">({d <= 0 ? '今天' : `${d} 天后`})</span>}</div></div>
            <div className="bg-black/30 rounded p-3 col-span-2"><div className="text-xs text-gray-400">免年费条件</div>
              <div className="font-bold mt-1">{WAIVER_LABEL[card.waiver_type]}</div>
              {(card.waiver_type === 'count' || card.waiver_type === 'amount') && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-300 mb-1">
                    <span>{card.waiver_type === 'count' ? `${card.progress_count || 0}/${card.waiver_count} 笔` : `${fmtMoney(card.progress_amount, card.currency)}/${fmtMoney(card.waiver_amount, card.currency)}`}</span>
                    {met && <span className="text-emerald-400 font-bold">✓ 已达成</span>}
                  </div>
                  <ProgressBar pct={waiverPct(card)} />
                  <div className="flex gap-2 mt-3">
                    {card.waiver_type === 'count' && (
                      <>
                        <input className={inputCls + ' !w-20'} type="number" min="1" value={cnt} onChange={(e) => setCnt(e.target.value)} />
                        <Btn onClick={addProgress}>记 {cnt || 0} 笔</Btn>
                      </>
                    )}
                    {card.waiver_type === 'amount' && (
                      <>
                        <input className={inputCls + ' !w-32'} type="number" placeholder="金额" value={amt} onChange={(e) => setAmt(e.target.value)} />
                        <Btn onClick={addProgress}>记一笔</Btn>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {card.notes && <div className="bg-black/30 rounded p-3 col-span-2 text-xs text-gray-400">📝 {card.notes}</div>}
          </div>

          <div className="mt-5">
            <div className="flex items-center mb-2">
              <h4 className="font-bold">权益 ({benefits.length})</h4>
              <button className="ml-auto text-xs text-gray-300 hover:text-white underline" onClick={() => setAddBenefit(!addBenefit)}>{addBenefit ? '收起' : '+ 添加权益'}</button>
            </div>
            {addBenefit && (
              <div className="bg-black/30 rounded p-3 mb-3">
                <BenefitForm cardId={card.id} onCancel={() => setAddBenefit(false)} onSaved={() => { setAddBenefit(false); onChanged() }} />
              </div>
            )}
            {benefits.length === 0 && <div className="text-sm text-gray-500 py-3">还没有登记权益。</div>}
            {benefits.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{b.name}</div>
                  <div className="text-xs text-gray-400">
                    {b.type === 'count' ? `已用 ${b.used_count || 0}/${b.total_count}` : ''} {b.value ? `· 价值 ${fmtMoney(b.value, b.currency)}` : ''} {b.expire_date ? `· ${b.expire_date} 到期` : ''}
                  </div>
                </div>
                <Btn ghost onClick={() => useBenefit(b)}>用一次 +3XP</Btn>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            <Btn ghost onClick={() => setEditing(true)}>编辑</Btn>
            <Btn ghost className="!bg-white/5 text-gray-400" onClick={archive}>归档卡片</Btn>
          </div>
        </>
      )}
    </div>
  )
}

function CardForm({ card, onCancel, onSaved }: any) {
  const [f, setF] = useState<any>(card ? { ...card } : {
    bank: '', name: '', currency: 'CNY', annual_fee: '', fee_month: '', fee_day: '',
    waiver_type: 'none', waiver_count: '', waiver_amount: '', notes: '',
  })
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="银行"><input className={inputCls} value={f.bank} onChange={set('bank')} placeholder="如 招商银行 / Chase" /></Field>
        <Field label="卡名(可用别名)"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="如 白金主卡" /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="年费金额"><input className={inputCls} type="number" value={f.annual_fee ?? ''} onChange={set('annual_fee')} placeholder="0" /></Field>
        <Field label="扣费月(1-12)"><input className={inputCls} type="number" min="1" max="12" value={f.fee_month ?? ''} onChange={set('fee_month')} /></Field>
        <Field label="扣费日(1-28)"><input className={inputCls} type="number" min="1" max="28" value={f.fee_day ?? ''} onChange={set('fee_day')} /></Field>
        <Field label="免年费方式">
          <select className={inputCls} value={f.waiver_type} onChange={set('waiver_type')}>
            <option value="none">无(刚性)</option>
            <option value="count">按笔数</option>
            <option value="amount">按金额</option>
            <option value="rigid">刚性年费(有权益)</option>
          </select>
        </Field>
        {f.waiver_type === 'count' && <Field label="免年费需要笔数"><input className={inputCls} type="number" value={f.waiver_count ?? ''} onChange={set('waiver_count')} /></Field>}
        {f.waiver_type === 'amount' && <Field label="免年费需要金额"><input className={inputCls} type="number" value={f.waiver_amount ?? ''} onChange={set('waiver_amount')} /></Field>}
        <div className="col-span-2"><Field label="备注"><input className={inputCls} value={f.notes || ''} onChange={set('notes')} placeholder="权益要点、客服电话等" /></Field></div>
      </div>
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      <div className="flex gap-2">
        <Btn onClick={save}>保存</Btn>
        <Btn ghost onClick={onCancel}>取消</Btn>
      </div>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="权益名称"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="如 机场贵宾厅" /></Field></div>
        <Field label="类型">
          <select className={inputCls} value={f.type} onChange={set('type')}>
            <option value="count">次数型</option>
            <option value="date">日期型</option>
            <option value="amount">金额型</option>
          </select>
        </Field>
        {f.type === 'count' && <Field label="每年次数"><input className={inputCls} type="number" value={f.total_count} onChange={set('total_count')} /></Field>}
        <Field label="单次/总价值(估算)"><input className={inputCls} type="number" value={f.value} onChange={set('value')} /></Field>
        <Field label="币种">
          <select className={inputCls} value={f.currency} onChange={set('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="col-span-2"><Field label="到期日(次数型为重置日)"><input className={inputCls} type="date" value={f.expire_date} onChange={set('expire_date')} /></Field></div>
      </div>
      {err && <div className="text-nfx-red text-sm mb-2">{err}</div>}
      <div className="flex gap-2">
        <Btn onClick={save}>保存权益</Btn>
        <Btn ghost onClick={onCancel}>取消</Btn>
      </div>
    </div>
  )
}
