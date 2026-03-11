import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { generateId, isValidAddress } from '@/lib/utils';
import { validateEmail } from '@/lib/validateEmail';
import { JoinWorkshopRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: JoinWorkshopRequest = await request.json();
    const { sessionCode, walletAddress, email, displayName } = body;

    if (!sessionCode || !walletAddress || !displayName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Session code, wallet address, display name, and email are required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const emailError = validateEmail(email!);
    if (emailError) {
      return NextResponse.json(
        { error: emailError },
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

    // Check if this wallet is the host
    if (walletAddress.toLowerCase() === workshop.host_wallet.toLowerCase()) {
      return NextResponse.json(
        { error: 'Host cannot join as an attendee. Please access the host dashboard directly.' },
        { status: 403 }
      );
    }

    // Check if attendee is using the host's email
    if (email && workshop.host_email && email.toLowerCase().trim() === workshop.host_email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This email belongs to the workshop host. Please use a different email address.' },
        { status: 403 }
      );
    }

    // Check if attendee already joined by wallet address
    const { data: existingByWallet } = await supabase
      .from('attendees')
      .select('*')
      .eq('workshop_id', workshop.id)
      .eq('wallet_address', walletAddress)
      .single();

    if (existingByWallet) {
      // Update last_seen to track activity
      await supabase
        .from('attendees')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', existingByWallet.id);

      // Return existing attendee with clear indication they're rejoining
      return NextResponse.json({
        workshop,
        attendee: existingByWallet,
        alreadyJoined: true,
        reason: 'wallet',
        message: 'Welcome back! Your wallet is already registered for this workshop.'
      });
    }

    // Check if email is already used in this workshop (if email provided)
    if (email && email.trim()) {
      const { data: existingByEmail } = await supabase
        .from('attendees')
        .select('*')
        .eq('workshop_id', workshop.id)
        .eq('email', email.toLowerCase().trim())
        .single();

      if (existingByEmail) {
        return NextResponse.json(
          { 
            error: `This email (${email}) is already registered for this workshop. Please use a different email or connect with the wallet you used previously.`,
            reason: 'email',
            existingWallet: existingByEmail.wallet_address.slice(0, 6) + '...' + existingByEmail.wallet_address.slice(-4)
          },
          { status: 409 }
        );
      }
    }

    // Normalize email before insertion
    const normalizedEmail = email && email.trim() ? email.toLowerCase().trim() : null;

    // Create new attendee
    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .insert({
        id: generateId(),
        workshop_id: workshop.id,
        wallet_address: walletAddress,
        email: normalizedEmail,
        display_name: displayName || null,
      })
      .select()
      .single();

    if (attendeeError) {
      console.error('Failed to create attendee:', attendeeError);
      
      // Check for constraint violations
      if (attendeeError.code === '23505') {
        // Determine which constraint was violated
        if (attendeeError.message?.includes('email')) {
          return NextResponse.json(
            { 
              error: 'This email is already registered for this workshop.',
              reason: 'email'
            },
            { status: 409 }
          );
        }
        
        return NextResponse.json(
          { 
            error: 'You have already joined this workshop. Please refresh the page.',
            reason: 'wallet'
          },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to join workshop' },
        { status: 500 }
      );
    }

    // Send system message for new join
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
      message: 'Successfully joined the workshop!'
    });
  } catch (error) {
    console.error('Error joining workshop:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
