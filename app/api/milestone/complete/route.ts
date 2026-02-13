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
