// 浮层:行动卡 + 底部抽屉(移动端支持下拉关闭)
import React, { useEffect, useRef, useState } from 'react'

export function ActionCard({ level = 'info', icon, title, fact, action, children }: any) {
  const bar = level === 'urgent' ? 'bg-urgent' : level === 'warning' ? 'bg-amber-400' : level === 'habit' ? 'bg-gold' : 'bg-track'
  return (
    <div className="rise sheet-card rounded-[20px] p-4 flex gap-3">
      <div className={`w-1 rounded-full shrink-0 ${bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[15px] leading-snug">{title}</div>
            {fact && <div className="text-[13px] text-t2 mt-1 leading-relaxed">{fact}</div>}
          </div>
          {action}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children, wide }: any) {
  const [dy, setDy] = useState(0)
  const startY = useRef<number | null>(null)
  useEffect(() => { if (open) setDy(0) }, [open])
  if (!open) return null
  const down = (e: any) => { startY.current = e.clientY }
  const move = (e: any) => {
    if (startY.current == null || e.pointerType === 'mouse') return
    setDy(Math.max(0, e.clientY - startY.current))
  }
  const up = () => {
    if (dy > 90) { startY.current = null; onClose() } else setDy(0)
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-6"
      style={{ animation: 'v3-fade .2s ease both' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-card rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] overflow-y-auto anim-up`}>
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur px-5 pt-3 pb-3.5 border-b border-inkline rounded-t-[24px]">
          <div className="sm:hidden mx-auto w-10 h-1.5 rounded-full bg-track mb-3 cursor-grab touch-none select-none"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <div className="flex items-center">
            <h3 className="font-bold text-[17px]">{title}</h3>
            <button aria-label="关闭" className="btn-press ml-auto w-8 h-8 rounded-full bg-chip hover:bg-track leading-none" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="px-5 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  )
}
