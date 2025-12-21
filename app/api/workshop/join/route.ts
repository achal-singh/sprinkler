import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { generateId, isValidAddress } from '@/lib/utils';
import { JoinWorkshopRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: JoinWorkshopRequest = await request.json();
    const { sessionCode, walletAddress, email, displayName } = body;

    if (!sessionCode || !walletAddress) {
      return NextResponse.json(
        { error: 'Session code and wallet address are required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Find workshop by session code
    const { data: workshop, error: workshopError } = await supabase
      .from('workshops')
      .select('*')
      .eq('session_code', sessionCode.toUpperCase())
      .eq('status', 'active')
      .single();

    if (workshopError || !workshop) {
      return NextResponse.json(
        { error: 'Workshop not found or inactive' },
        { status: 404 }
      );
    }

    // Check if attendee already joined
    const { data: existingAttendee } = await supabase
      .from('attendees')
      .select('*')
      .eq('workshop_id', workshop.id)
      .eq('wallet_address', walletAddress)
      .single();

    if (existingAttendee) {
      // Update last_seen
      await supabase
        .from('attendees')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', existingAttendee.id);

      return NextResponse.json({
        workshop,
        attendee: existingAttendee,
        alreadyJoined: true,
      });
    }

    // Create new attendee
    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .insert({
        id: generateId(),
        workshop_id: workshop.id,
        wallet_address: walletAddress,
        email: email || null,
        display_name: displayName || null,
      })
      .select()
      .single();

    if (attendeeError) {
      console.error('Failed to create attendee:', attendeeError);
      return NextResponse.json(
        { error: 'Failed to join workshop' },
        { status: 500 }
      );
    }

    // Send system message
    await supabase.from('chat_messages').insert({
      id: generateId(),
      workshop_id: workshop.id,
      sender_wallet: 'system',
      sender_name: 'System',
      message: `${displayName || walletAddress.slice(0, 6)} joined the workshop`,
      message_type: 'system',
    });

    return NextResponse.json({
      workshop,
      attendee,
      alreadyJoined: false,
    });
  } catch (error) {
    console.error('Error joining workshop:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
