import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import Anthropic from '@anthropic-ai/sdk'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const TONE_GUIDANCE: Record<string, string> = {
  gentle: 'Warm and kind. Focus on "this isn\'t working" rather than blame. Leave them with their dignity. No clichés.',
  direct: 'Clear and honest. No softening phrases, but no cruelty either. Say the thing plainly. Short sentences.',
  savage: `Brutally honest, darkly funny, engineered to be screenshotted and sent to a group chat. This is the text that goes viral.

Follow this structure:
1. Open with one hyper-specific, unflinching observation about why this is over — so accurate it's uncomfortable
2. One unexpected comparison or callback that reframes the whole relationship in a single image (e.g. "dating you was like being on hold with customer service — lots of waiting, nothing ever resolved")
3. Close with something that lands so hard their friend says "they did NOT just send that"

Rules:
- Max 4 sentences. Every word earns its place.
- No softening. No "I think" or "I feel." Declarative sentences only.
- Use one specific detail from their reason — generic savage texts don't go viral, specific ones do.
- End on the unexpected turn, not the obvious one.
- The reader should immediately want to forward this to three people.`,
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'No session_id' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not complete' }, { status: 402 })
  }

  const { duration, reason, tone, ventMode } = session.metadata as {
    duration: string
    reason: string
    tone: string
    ventMode?: string
  }

  const toneGuide = TONE_GUIDANCE[tone] || TONE_GUIDANCE.direct
  const isVentMode = ventMode === 'true'

  const userContent = isVentMode
    ? `Here's the situation: ${reason}\nTone: ${tone}`
    : `Relationship length: ${duration.replace(/-/g, ' ')}\nReason for ending it: ${reason}\nTone: ${tone}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You write breakup texts. Keep them to 3–5 sentences. Sound human — no AI language, no hollow phrases.
Tone guidance: ${toneGuide}
Never include names. Never be targeted, cruel, or harassing toward the specific person.
Output only the breakup text itself — no intro, no explanation.`,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  return NextResponse.json({ text, tone, duration })
}
