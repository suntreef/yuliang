// 基础控件:输入/按钮/标签/空态/语义涨跌/数字动效/进度条
import React, { useEffect, useState } from 'react'
import { fmtCompact } from '../api'

export const inputCls = 'w-full bg-card border border-inkline rounded-[14px] px-3.5 py-2.5 text-[16px] outline-none focus:border-brand transition-colors placeholder:text-t3'

export function Field({ label, children, hint }: any) {
  return (
    <label className="block mb-4">
      <div className="text-[13px] text-t2 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-t3 mt-1.5">{hint}</div>}
    </label>
  )
}

export function Btn({ children, className = '', ghost, tone, ...p }: any) {
  const toneCls = tone === 'gold' ? 'bg-gold text-white hover:bg-amber-500'
    : tone === 'mint' ? 'bg-brand text-white hover:bg-brand-deep'
      : ghost ? 'ghost-btn'
        : 'text-white'
  const primaryStyle = !(ghost || tone) ? { background: 'var(--g-brand)', boxShadow: '0 6px 16px rgba(47, 143, 131, 0.3), inset 0 1px 0 rgba(255,255,255,.35)' } : undefined
  return <button {...p} style={{ ...primaryStyle, ...p.style }} className={`btn-press px-4 py-2.5 rounded-[16px] font-bold text-[15px] disabled:opacity-40 ${toneCls} ${className}`}>{children}</button>
}

export function Chip({ children, tone = 'default' }: any) {
  return <span className={`tint tint-${tone}`}>{children}</span>
}

export function Empty({ icon = '🫧', text }: any) {
  return (
    <div className="text-center py-12">
      <div className="text-3xl mb-3 opacity-50">{icon}</div>
      <div className="text-sm text-t2">{text}</div>
    </div>
  )
}

// 语义:朱砂涨 · 石绿跌(中国习惯红涨绿跌)
export function Delta({ value, ccy = 'CNY', compact = true }: { value: any, ccy?: string, compact?: boolean }) {
  const v = Number(value) || 0
  if (v === 0) return <span className="text-t3">持平</span>
  const up = v > 0
  return (
    <span className={`num font-bold ${up ? 'text-up' : 'text-down'}`}>
      {up ? '▲' : '▼'} {compact ? fmtCompact(Math.abs(v), ccy) : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Math.abs(v)) + ' ' + ccy}
    </span>
  )
}

export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(target)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function BigNumber({ value, ccy }: { value: number, ccy: string }) {
  const v = useCountUp(value)
  return <span className="num text-[34px] leading-tight font-black">{fmtCompact(v, ccy)}</span>
}

export function ProgressBar({ pct, className = '' }: any) {
  const p = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className={`h-1.5 rounded-full bg-track overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${p >= 100 ? 'bg-up' : 'bg-brand'}`} style={{ width: p + '%', transition: 'width .6s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  )
}
