import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://dump-dot-lol.vercel.app'

export async function POST(req: NextRequest) {
  const { duration, reason, tone, ref } = await req.json()

  if (!duration || !reason || !tone) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const metadata: Record<string, string> = {
    duration,
    reason: reason.slice(0, 500),
    tone,
  }
  if (ref) metadata.affiliate_code = String(ref).slice(0, 50)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    metadata,
    success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/`,
  })

  return NextResponse.json({ url: session.url })
}
