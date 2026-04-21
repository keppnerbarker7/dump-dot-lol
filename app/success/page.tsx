'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

// Flow:
// 1. Page loads → fetch generated text (hidden)
// 2. Prompt: "Record your reaction? Camera on before you see the text."
// 3. If yes → request camera+mic → countdown → recording starts → text reveals
// 4. If no → text reveals immediately, camera opt-in available after

type Stage =
  | 'loading'       // fetching text
  | 'camera-prompt' // ask before revealing
  | 'camera-setup'  // camera on, waiting to hit record
  | 'countdown'     // 3-2-1
  | 'recording'     // text revealing + recording
  | 'done-recorded' // recording complete, download available
  | 'revealed'      // text shown, no recording
  | 'error'

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')

  const [stage, setStage] = useState<Stage>('loading')
  const [text, setText] = useState('')
  const [displayed, setDisplayed] = useState('')
  const [textDone, setTextDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const textRef = useRef('')

  // Fetch text on load
  useEffect(() => {
    if (!sessionId) { setStage('error'); setErrorMsg('No session found.'); return }
    fetch(`/api/generate?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrorMsg(data.error); setStage('error'); return }
        setText(data.text)
        textRef.current = data.text
        setStage('camera-prompt')
      })
      .catch(() => { setErrorMsg('Something went wrong. Refresh the page.'); setStage('error') })
  }, [sessionId])

  function skipCamera() {
    setStage('revealed')
    revealText()
  }

  async function enableCamera() {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStage('camera-setup')
    } catch {
      setCameraError('Camera or mic permission denied. Check your browser settings.')
    }
  }

  function startCountdown() {
    setStage('countdown')
    setCountdown(3)
    let count = 3
    const interval = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(interval)
        startRecordingAndReveal()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  function startRecordingAndReveal() {
    if (!canvasRef.current || !videoRef.current || !streamRef.current) return
    setStage('recording')
    chunksRef.current = []

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const W = 720, H = 1280
    canvas.width = W
    canvas.height = H

    // Prefer MP4 for iOS compatibility, fall back to webm
    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm'

    // Combine canvas stream + audio track from mic
    const canvasStream = canvas.captureStream(30)
    const audioTracks = streamRef.current.getAudioTracks()
    audioTracks.forEach(t => canvasStream.addTrack(t))

    const recorder = new MediaRecorder(canvasStream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setVideoBlob(blob)
      setStage('done-recorded')
    }
    recorder.start()

    // Draw loop
    let currentIndex = 0
    let drawInterval: ReturnType<typeof setInterval>

    function draw() {
      ctx.fillStyle = '#0f0f0f'
      ctx.fillRect(0, 0, W, H)

      // Webcam — top 55%
      if (videoRef.current) {
        const camH = Math.floor(H * 0.55)
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(videoRef.current, -W, 0, W, camH)
        ctx.restore()
      }

      // Text area — bottom 45%
      const textAreaY = Math.floor(H * 0.55)
      const textAreaH = H - textAreaY
      ctx.fillStyle = '#111111'
      ctx.fillRect(0, textAreaY, W, textAreaH)

      // Divider
      ctx.fillStyle = '#ff3b7f'
      ctx.fillRect(0, textAreaY, W, 3)

      // Typewriter text — font sized to fit
      const partial = textRef.current.slice(0, currentIndex)
      const fontSize = 24
      const lineH = 38
      const padding = 44
      const maxWidth = W - padding * 2

      ctx.fillStyle = '#f5f5f5'
      ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'left'

      const words = partial.split(' ')
      const lines: string[] = []
      let line = ''
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = test
        }
      }
      if (line) lines.push(line)

      // Vertically center text in text area with top bias
      const totalTextH = lines.length * lineH
      const startY = textAreaY + Math.min(48, (textAreaH - totalTextH) / 2)

      lines.forEach((l, i) => {
        ctx.fillText(l, padding, startY + i * lineH)
      })

      // Branding
      ctx.fillStyle = '#444'
      ctx.font = '20px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('dump.lol', W / 2, H - 30)
    }

    drawInterval = setInterval(draw, 33)

    // Typewriter driven by interval
    const revealInterval = setInterval(() => {
      currentIndex++
      setDisplayed(textRef.current.slice(0, currentIndex))
      if (currentIndex >= textRef.current.length) {
        clearInterval(revealInterval)
        setTextDone(true)
        // Hold 3s after text finishes, then stop
        setTimeout(() => {
          clearInterval(drawInterval)
          recorder.stop()
          // Stop all tracks
          streamRef.current?.getTracks().forEach(t => t.stop())
        }, 3000)
      }
    }, 40)
  }

  function revealText() {
    setDisplayed('')
    setTextDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(textRef.current.slice(0, i))
      if (i >= textRef.current.length) {
        clearInterval(interval)
        setTextDone(true)
      }
    }, 40)
  }

  function copyText() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareTwitter() {
    const tweet = encodeURIComponent(
      `I used AI to write my breakup text and honestly it's better than anything I would've said 💀 dump.lol`
    )
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, '_blank')
  }

  function downloadVideo() {
    if (!videoBlob) return
    const url = URL.createObjectURL(videoBlob)
    const a = document.createElement('a')
    a.href = url
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm'
    a.download = `dump-dot-lol-reaction.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!sessionId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
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

        {/* Loading */}
        {stage === 'loading' && (
          <div className="text-center text-[#888] text-sm animate-pulse">
            Writing your text...
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Camera prompt — shown before text reveals */}
        {stage === 'camera-prompt' && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-[#f5f5f5]">Your text is ready.</p>
              <p className="text-[#888] text-sm leading-relaxed">
                Record your reaction as it reveals for a TikTok-ready video — camera starts before you see a single word.
              </p>
            </div>
            <button
              onClick={enableCamera}
              className="w-full bg-brand hover:bg-[#e02d6b] text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              → Record my reaction (recommended)
            </button>
            {cameraError && <p className="text-red-400 text-xs text-center">{cameraError}</p>}
            <button
              onClick={skipCamera}
              className="w-full border border-[#333] hover:border-[#555] text-[#666] hover:text-[#aaa] py-2.5 rounded-lg transition-colors text-sm"
            >
              Just show me the text
            </button>
            <p className="text-xs text-[#444] text-center">Your video stays on your device. We never see it.</p>
          </div>
        )}

        {/* Camera live preview — ready to record */}
        {stage === 'camera-setup' && (
          <div className="space-y-4">
            <p className="text-sm text-[#888] text-center">
              Position yourself. Hit record when ready — the text will reveal as you watch.
            </p>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg aspect-video object-cover bg-black"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-[#555] text-center">
              Tip: read the text aloud as it types — makes a better video
            </p>
            <button
              onClick={startCountdown}
              className="w-full bg-brand hover:bg-[#e02d6b] text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Start recording
            </button>
          </div>
        )}

        {/* Countdown */}
        {stage === 'countdown' && (
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg aspect-video object-cover bg-black"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="text-center text-7xl font-bold text-brand py-2">
              {countdown}
            </div>
          </div>
        )}

        {/* Recording + live text reveal */}
        {stage === 'recording' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-[#555]">dump.lol</span>
              <span className="text-brand text-xs animate-pulse font-medium">● REC</span>
            </div>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full rounded-lg aspect-video object-cover bg-black"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 min-h-[120px]">
              <p className="text-[#f5f5f5] text-base leading-relaxed font-mono">
                {displayed}
                {!textDone && <span className="cursor-blink">|</span>}
              </p>
            </div>
          </div>
        )}

        {/* Recording done — download */}
        {stage === 'done-recorded' && (
          <div className="space-y-5">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[#f5f5f5] text-base leading-relaxed font-mono">{text}</p>
              <p className="text-xs text-[#444] mt-3 text-right">dump.lol</p>
            </div>
            <div className="flex gap-3">
              <button onClick={copyText} className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors">
                {copied ? 'Copied!' : 'Copy text'}
              </button>
              <button onClick={shareTwitter} className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors">
                Share on X
              </button>
            </div>
            {videoBlob && (
              <div className="space-y-3 border-t border-[#2a2a2a] pt-5">
                <p className="text-sm text-[#aaa] font-medium">Reaction video ready.</p>
                <button
                  onClick={downloadVideo}
                  className="w-full bg-brand hover:bg-[#e02d6b] text-white font-semibold py-3 rounded-lg transition-colors text-sm"
                >
                  Download for TikTok / Instagram
                </button>
                <p className="text-xs text-[#444]">
                  {videoBlob.type.includes('mp4')
                    ? 'Saved as .mp4 — plays on all devices.'
                    : 'Saved as .webm — plays on Android, Chrome, TikTok. On iPhone, share directly from TikTok app.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Text revealed, no recording */}
        {stage === 'revealed' && (
          <div className="space-y-5">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 min-h-[120px]">
              <p className="text-[#f5f5f5] text-base leading-relaxed font-mono">
                {displayed}
                {!textDone && <span className="cursor-blink">|</span>}
              </p>
              <p className="text-xs text-[#444] mt-3 text-right">dump.lol</p>
            </div>
            {textDone && (
              <>
                <div className="flex gap-3">
                  <button onClick={copyText} className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors">
                    {copied ? 'Copied!' : 'Copy text'}
                  </button>
                  <button onClick={shareTwitter} className="flex-1 border border-[#333] hover:border-[#555] text-[#ccc] text-sm py-2.5 rounded-lg transition-colors">
                    Share on X
                  </button>
                </div>
                <button
                  onClick={() => { setStage('camera-prompt') }}
                  className="w-full border border-[#333] hover:border-brand text-[#666] hover:text-brand text-sm py-2.5 rounded-lg transition-colors"
                >
                  → Record a reaction video anyway
                </button>
              </>
            )}
          </div>
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
