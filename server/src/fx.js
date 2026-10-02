import { getKV, setKV, getJSON, tx } from './db.js'
import { today } from './util.js'

export const baseCurrency = (db) => getKV(db, 'base_currency', 'CNY')

function usedCurrencies(db) {
  const rows = db.prepare(`
    SELECT DISTINCT currency AS c FROM accounts
    UNION SELECT DISTINCT currency FROM cards
    UNION SELECT DISTINCT currency FROM benefits
    UNION SELECT DISTINCT currency FROM goals
  `).all()
  return rows.map((r) => r.c).filter(Boolean)
}

// 每日抓取:手动汇率始终优先;frankfurter.app(ECB)兜底其余币种;失败沿用旧值
export async function fetchRates(db) {
  const base = baseCurrency(db)
  const manual = getJSON(db, 'fx_manual', {})
  const d = today()
  const ins = db.prepare(`INSERT INTO fx_rates(date,currency,rate) VALUES(?,?,?)
    ON CONFLICT(date,currency) DO UPDATE SET rate=excluded.rate`)
  tx(db, () => {
    ins.run(d, base, 1)
    for (const [ccy, r] of Object.entries(manual)) {
      if (ccy !== base && Number(r) > 0) ins.run(d, ccy, Number(r))
    }
  })

  let ok = false
  try {
    const res = await fetch('https://api.frankfurter.app/latest?base=EUR')
    if (res.ok) {
      const j = await res.json()
      const wanted = new Set([...usedCurrencies(db), 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'SGD', 'AUD', 'CAD', 'CHF', 'KRW', 'THB', 'MYR'])
      const perEurBase = base === 'EUR' ? 1 : j.rates[base]
      tx(db, () => {
        for (const ccy of wanted) {
          if (ccy === 'EUR' || ccy === base || !j.rates[ccy] || !perEurBase) continue
          const rate = perEurBase / j.rates[ccy] // 1 ccy = rate * base
          if (!manual[ccy]) ins.run(d, ccy, rate)
        }
      })
      ok = true
    }
  } catch { /* 离线:沿用手动/旧值 */ }
  setKV(db, 'fx_last_fetch', JSON.stringify({ date: d, ok }))
  return ok
}

// 汇率回溯:date 当天(含)以前最近一条记录;没有则手动值;再没有按 1:1(仅影响历史展示)
export function rateOn(db, date, ccy) {
  const base = baseCurrency(db)
  if (ccy === base) return 1
  const r = db.prepare('SELECT rate FROM fx_rates WHERE currency = ? AND date <= ? ORDER BY date DESC LIMIT 1').get(ccy, date)
  if (r) return r.rate
  const manual = getJSON(db, 'fx_manual', {})[ccy]
  return Number(manual) > 0 ? Number(manual) : 1
}
