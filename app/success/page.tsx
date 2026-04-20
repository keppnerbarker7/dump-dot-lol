'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  const [text, setText] = useState('')
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Camera state
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [cameraError, setCameraError] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const replayIndexRef = useRef(0)
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRecordingRef = useRef(false)

  // Fetch the generated text
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/generate?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setText(data.text)
      })
      .catch(() => setError('Something went wrong. Refresh the page.'))
  }, [sessionId])

  // Typewriter effect
  useEffect(() => {
    if (!text) return
    let i = 0
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1))
      i++
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [text])

  function copyText() {
    navigator.clipboard.writeText(text)
  }

  function shareTwitter() {
    const tweet = encodeURIComponent(
      `I used AI to write my breakup text and honestly it's better than anything I would've said 💀 dump.lol`
    )
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, '_blank')
  }

  async function enableCamera() {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraEnabled(true)
    } catch {
      setCameraError('Camera permission denied. Try again from your browser settings.')
    }
  }

  function startReplayAndRecord() {
    if (!canvasRef.current || !videoRef.current || !streamRef.current) return
    setVideoBlob(null)
    chunksRef.current = []
    replayIndexRef.current = 0
    setDisplayed('')
    isRecordingRef.current = true
    setRecording(true)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const W = 720, H = 1280
    canvas.width = W
    canvas.height = H

    // Draw loop — uses ref to avoid stale closure
    function draw() {
      ctx.fillStyle = '#0f0f0f'
      ctx.fillRect(0, 0, W, H)

      // Webcam — top half
      if (videoRef.current) {
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(videoRef.current, -W, 0, W, H / 2)
        ctx.restore()
      }

      // Text area — bottom half
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, H / 2, W, H / 2)

      // Typewriter text
      const partial = text.slice(0, replayIndexRef.current)
      ctx.fillStyle = '#f5f5f5'
      ctx.font = '28px system-ui, sans-serif'
      ctx.textAlign = 'left'
      const words = partial.split(' ')
      let line = '', y = H / 2 + 60, lineH = 44
      for (const word of words) {
        const test = line + word + ' '
        if (ctx.measureText(test).width > W - 80 && line) {
          ctx.fillText(line.trim(), 40, y)
          line = word + ' '
          y += lineH
        } else {
          line = test
        }
      }
      if (line) ctx.fillText(line.trim(), 40, y)

      // Branding
      ctx.fillStyle = '#555'
      ctx.font = '22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('dump.lol', W / 2, H - 40)
    }

    const canvasStream = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
    const recorder = new MediaRecorder(canvasStream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setVideoBlob(blob)
      setRecording(false)
    }
    recorder.start()

    // Draw at 30fps
    const drawInterval = setInterval(draw, 33)

    // Replay typewriter
    let i = 0
    replayTimerRef.current = setInterval(() => {
      i++
      replayIndexRef.current = i
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(replayTimerRef.current!)
        // 3 extra seconds after text completes
        setTimeout(() => {
          isRecordingRef.current = false
          clearInterval(drawInterval)
          recorder.stop()
        }, 3000)
      }
    }, 35)
  }

  function startCountdownThenRecord() {
    setCountdown(3)
    let count = 3
    const interval = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(interval)
        setCountdown(null)
        startReplayAndRecord()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  function downloadVideo() {
    if (!videoBlob) return
    const url = URL.createObjectURL(videoBlob)
    const a = document.createElement('a')
    a.href = url
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm'
    a.download = `my-breakup-reaction.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#888]">No session found. <a href="/" className="text-brand underline">Start over.</a></p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8">

        <div className="text-center">
          <span className="text-sm font-mono text-[#888] tracking-widest uppercase">dump.lol</span>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!text && !error && (
          <div className="text-center text-[#888] text-sm animate-pulse">
            Writing your text...
          </div>
        )}

        {text && (
          <>
            {/* Typewriter card */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 min-h-[160px]">
              <p className="text-[#f5f5f5] text-base leading-relaxed font-mono">
                {displayed}
                {!done && <span className="cursor-blink">|</span>}
              </p>
              <p className="text-xs text-[#444] mt-4 text-right">dump.lol</p>
            </div>

            {/* Action buttons */}
            {done && (
              <div className="flex gap-3">
                <button
                  onClick={copyText}
                  className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors"
                >
                  Copy text
                </button>
                <button
                  onClick={shareTwitter}
                  className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors"
                >
                  Share on X
                </button>
              </div>
            )}

            {/* Camera section */}
            {done && (
              <div className="border-t border-[#2a2a2a] pt-6 space-y-4">
                <div className="text-sm text-[#888]">
                  Want a TikTok-ready reaction video?
                </div>

                {!cameraEnabled && (
                  <>
                    <button
                      onClick={enableCamera}
                      className="w-full bg-[#1a1a1a] border border-[#333] hover:border-brand text-[#ccc] hover:text-brand text-sm py-3 rounded-lg transition-colors"
                    >
                      → Enable camera — watch the text reveal again
                    </button>
                    <p className="text-xs text-[#444]">
                      Your video stays on your device. We never see it.
                    </p>
                    {cameraError && <p className="text-red-400 text-xs">{cameraError}</p>}
                  </>
                )}

                {cameraEnabled && !recording && !videoBlob && (
                  <div className="space-y-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-lg aspect-video object-cover bg-black"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {countdown !== null ? (
                      <div className="w-full text-center text-5xl font-bold text-brand py-3">
                        {countdown}
                      </div>
                    ) : (
                      <button
                        onClick={startCountdownThenRecord}
                        className="w-full bg-brand hover:bg-[#e02d6b] text-white text-sm font-semibold py-3 rounded-lg transition-colors"
                      >
                        Record my reaction
                      </button>
                    )}
                  </div>
                )}

                {recording && (
                  <div className="space-y-3">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-lg aspect-video object-cover bg-black"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="text-center text-brand text-sm animate-pulse">
                      ● Recording
                    </div>
                  </div>
                )}

                {videoBlob && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#aaa]">Your reaction video is ready.</p>
                    <button
                      onClick={downloadVideo}
                      className="w-full bg-brand hover:bg-[#e02d6b] text-white text-sm font-semibold py-3 rounded-lg transition-colors"
                    >
                      Download reaction video
                    </button>
                    <p className="text-xs text-[#555]">
                      Saved as .webm — plays natively on TikTok, Instagram, Twitter.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-[#444]">
          dump.lol — <a href="/" className="hover:text-[#666]">make another one</a>
        </p>
      </div>
    </main>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[#888] text-sm animate-pulse">Loading...</p>
      </main>
    }>
      <SuccessContent />
    </Suspense>
  )
}
