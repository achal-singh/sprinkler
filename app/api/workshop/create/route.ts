import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { generateSessionCode, generateId } from '@/lib/utils'
import { CreateWorkshopRequest, CreateWorkshopResponse } from '@/lib/types'
import QRCode from 'qrcode'

export async function POST(request: NextRequest) {
  try {
    const body: CreateWorkshopRequest = await request.json()
    const { title, description, hostWallet } = body

    if (!title || !hostWallet) {
      return NextResponse.json(
        { error: 'Title and host wallet are required' },
        { status: 400 }
      )
    }

    const supabase = getServerSupabase()
    const sessionCode = generateSessionCode()
    const workshopId = generateId()

    // Create workshop in database
    const { data: workshop, error } = await supabase
      .from('workshops')
      .insert({
        id: workshopId,
        title,
        description,
        host_wallet: hostWallet,
        session_code: sessionCode,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create workshop' },
        { status: 500 }
      )
    }

    // Generate join URL and QR code
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    const joinUrl = `${baseUrl}/workshop/join?code=${sessionCode}`

    const qrCodeUrl = await QRCode.toDataURL(joinUrl, {
      width: 300,
      margin: 2
    })

    const response: CreateWorkshopResponse = {
      workshop,
      qrCodeUrl,
      joinUrl
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error creating workshop:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
