// 图表:三环进度 + 可触点拖动的净资产曲线
import React, { useRef, useState } from 'react'
import { fmtCompact } from '../api'
import { Delta, Empty } from './controls'

export function Ring({ ratio, label, color = '#2f8f83', size = 52 }: any) {
  const r = (size - 7) / 2
  const C = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, ratio || 0))
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--c-track)" strokeWidth="4.5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth="4.5" fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 2px 4px ${color}44)` }} />
      </svg>
      <div className="text-[10px] text-t3">{label}</div>
    </div>
  )
}

// 触点拖动查看任意一天;纵向手势仍归页面滚动(touch-action: pan-y)
export function ScrubChart({ series, height = 200 }: any) {
  const ref = useRef<HTMLDivElement>(null)
  const [hi, setHi] = useState<number | null>(null)
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '')
  if (!series || series.length < 2) return <Empty icon="📈" text="记下第一笔快照,曲线才会长出来" />
  const W = 800
  const H = height
  const P = 12
  const vals = series.map((p: any) => p.net)
  let min = Math.min(...vals, 0)
  let max = Math.max(...vals, 1)
  if (min === max) { min -= 1; max += 1 }
  const x = (i: number) => P + (i / (series.length - 1)) * (W - 2 * P)
  const y = (v: number) => P + (1 - (v - min) / (max - min)) * (H - 2 * P)
  const line = series.map((p: any, i: number) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ')
  const area = `${line} L${x(series.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`
  const first = vals[0]
  const last = vals[vals.length - 1]
  const color = last >= first ? '#c3492f' : '#4a9463'
  const hp = hi != null ? series[hi] : null
  const lx = x(series.length - 1)
  const ly = y(last)

  const locate = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setHi(Math.round(r * (series.length - 1)))
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap min-h-[2.4rem]">
        {hp ? (
          <>
            <span className="num text-[26px] font-black">{fmtCompact(hp.net)}</span>
            <span className="text-xs text-t3">{hp.date}</span>
            <button className="ml-auto text-xs text-t3 underline" onClick={() => setHi(null)}>回到最新</button>
          </>
        ) : (
          <>
            <span className="num text-[26px] font-black">{fmtCompact(last)}</span>
            <Delta value={last - first} />
            <span className="ml-auto text-xs text-t3">{series[0].date} → {series[series.length - 1].date}</span>
          </>
        )}
      </div>
      <div ref={ref} className="mt-2" style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => locate(e.clientX)}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') locate(e.clientX) }}
        onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ height }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid + 'a'} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="70%" stopColor={color} stopOpacity="0.05" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} y1={P + f * (H - 2 * P)} x2={W - P} y2={P + f * (H - 2 * P)}
              stroke="var(--c-line)" strokeDasharray="3 6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={P} y1={y(0)} x2={W - P} y2={y(0)} stroke="var(--c-grid)" strokeDasharray="4 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={`url(#${gid}a)`} />
          <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} className="chart-line" vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 3px 5px ${color}55)` }} />
          {hp ? (
            <g>
              <line x1={x(hi)} y1={P} x2={x(hi)} y2={H - P} stroke="var(--c-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={x(hi)} cy={y(hp.net)} r="4.5" fill="var(--c-card)" stroke={color} strokeWidth="2.5" />
            </g>
          ) : (
            <g>
              <circle cx={lx} cy={ly} r="5" fill="none" stroke={color} strokeWidth="2" className="chart-pulse" />
              <circle cx={lx} cy={ly} r="4.5" fill={color} stroke="var(--c-card)" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-t3 mt-1">
        <span>低 {fmtCompact(min)}</span>
        <span>高 {fmtCompact(max)}</span>
      </div>
    </div>
  )
}
