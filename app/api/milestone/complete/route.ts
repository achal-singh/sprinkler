import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import { CompleteMilestoneRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: CompleteMilestoneRequest = await request.json();
    const { milestoneId, attendeeId, notes } = body;

    if (!milestoneId || !attendeeId) {
      return NextResponse.json(
        { error: 'Milestone ID and attendee ID are required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Check if already completed
    const { data: existing } = await supabase
      .from('milestone_completions')
      .select('*')
      .eq('milestone_id', milestoneId)
      .eq('attendee_id', attendeeId)
      .single();

    if (existing) {
      return NextResponse.json({
        completion: existing,
        alreadyCompleted: true,
      });
    }

    // Get milestone and attendee info for the message
    const { data: milestone } = await supabase
      .from('milestones')
      .select('title, workshop_id')
      .eq('id', milestoneId)
      .single();

    const { data: attendee } = await supabase
      .from('attendees')
      .select('display_name, wallet_address')
      .eq('id', attendeeId)
      .single();

    // Create completion
    const { data: completion, error } = await supabase
      .from('milestone_completions')
      .insert({
        id: generateId(),
        milestone_id: milestoneId,
        attendee_id: attendeeId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to complete milestone:', error);
      return NextResponse.json(
        { error: 'Failed to mark milestone as complete' },
        { status: 500 }
      );
    }

    // Send system message
    if (milestone && attendee) {
      const displayName = attendee.display_name || attendee.wallet_address.slice(0, 6);
      await supabase.from('chat_messages').insert({
        id: generateId(),
        workshop_id: milestone.workshop_id,
        sender_wallet: 'system',
        sender_name: 'System',
        message: `${displayName} completed: ${milestone.title}`,
        message_type: 'milestone_completed',
      });
    }

    return NextResponse.json({
      completion,
      alreadyCompleted: false,
    });
  } catch (error) {
    console.error('Error completing milestone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
