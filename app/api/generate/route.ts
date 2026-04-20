import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import Anthropic from '@anthropic-ai/sdk'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const TONE_GUIDANCE: Record<string, string> = {
  gentle: 'Warm and kind. Focus on "this isn\'t working" rather than blame. Leave them with their dignity. No clichés.',
  direct: 'Clear and honest. No softening phrases, but no cruelty either. Say the thing plainly. Short sentences.',
  savage: `Brutally honest and darkly funny. This is the one people screenshot. Write like someone who is done, has zero patience left, and is a little bit entertained by the whole thing. Sharp wit, maybe a callback to something specific about why it ended. Not mean-spirited — just completely over it and not pretending otherwise. Think: the text that makes their friend say "oh no they didn't." Max 4 sentences. End with something that lands.`,
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

  const { duration, reason, tone } = session.metadata as {
    duration: string
    reason: string
    tone: string
  }

  const toneGuide = TONE_GUIDANCE[tone] || TONE_GUIDANCE.direct

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
        content: `Relationship length: ${duration.replace(/-/g, ' ')}\nReason for ending it: ${reason}\nTone: ${tone}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  return NextResponse.json({ text, tone, duration })
}
