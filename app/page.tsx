'use client'

import { useState, FormEvent, useEffect } from 'react'

const DURATIONS = [
  { value: 'less-than-1-month', label: 'Less than a month' },
  { value: '1-6-months', label: '1–6 months' },
  { value: '6mo-2yr', label: '6 months – 2 years' },
  { value: '2yr-plus', label: '2+ years' },
]

const TONES = [
  { value: 'gentle', label: 'Gentle', desc: 'Kind. Still clear.' },
  { value: 'direct', label: 'Direct', desc: 'No softening. No meanness.' },
  { value: 'savage', label: 'Savage', desc: 'Brutally honest.' },
]

export default function Home() {
  const [duration, setDuration] = useState('')
  const [reason, setReason] = useState('')
  const [tone, setTone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ref, setRef] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refParam = params.get('ref')
    if (refParam) {
      setRef(refParam)
      document.cookie = `affiliate_ref=${refParam};max-age=2592000;path=/`
    } else {
      const match = document.cookie.match(/affiliate_ref=([^;]+)/)
      if (match) setRef(match[1])
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!duration || !reason.trim() || !tone) {
      setError('Fill in all three fields.')
      return
    }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, reason: reason.trim(), tone, ref }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Something went wrong. Try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <span className="text-sm font-mono text-[#888] tracking-widest uppercase">dump.lol</span>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight leading-tight">
            Write the text you&apos;ve been putting off.
          </h1>
          <p className="text-[#888] text-base leading-relaxed">
            Three questions. AI writes the breakup text.
            You decide if it sends.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">

          {/* Q1 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#ccc]">
              How long were you together?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                    duration === d.value
                      ? 'bg-brand border-brand text-white'
                      : 'border-[#333] text-[#aaa] hover:border-[#555]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q2 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#ccc]" htmlFor="reason">
              Main reason for ending it?
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="1–2 sentences. The AI uses this to make the text feel real."
              rows={3}
              maxLength={300}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#555] resize-none"
            />
          </div>

          {/* Q3 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#ccc]">Tone?</label>
            <div className="grid grid-cols-3 gap-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`px-3 py-3 rounded-lg text-sm border transition-colors text-center ${
                    tone === t.value
                      ? 'bg-brand border-brand text-white'
                      : 'border-[#333] text-[#aaa] hover:border-[#555]'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-[#e02d6b] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Redirecting to checkout...' : 'Write my breakup text — $5'}
          </button>

          <p className="text-xs text-[#555] text-center">
            Powered by Claude AI. We don&apos;t store names or personal details.
          </p>
        </form>

        {/* What you get */}
        <div className="space-y-2 text-sm text-[#666]">
          <div className="flex gap-2">
            <span>→</span>
            <span>Generates in ~10 seconds after checkout</span>
          </div>
          <div className="flex gap-2">
            <span>→</span>
            <span>Copy it, screenshot it, or record your reaction as a TikTok-ready video</span>
          </div>
          <div className="flex gap-2">
            <span>→</span>
            <span>Your video stays on your device. We never see it.</span>
          </div>
        </div>

        <p className="text-center text-xs text-[#444]">
          dump.lol — made by a human who wanted this to exist
        </p>
      </div>
    </main>
  )
}
