import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workshopId, hostWallet } = body;

    if (!workshopId || !hostWallet) {
      return NextResponse.json(
        { error: 'Workshop ID and host wallet are required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Verify user is the host
    const { data: workshop } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .eq('host_wallet', hostWallet)
      .single();

    if (!workshop) {
      return NextResponse.json(
        { error: 'Workshop not found or you are not the host' },
        { status: 403 }
      );
    }

    // Delete all related data
    // Order matters due to foreign key constraints

    // 1. Delete milestone completions
    await supabase
      .from('milestone_completions')
      .delete()
      .in('milestone_id', 
        supabase
          .from('milestones')
          .select('id')
          .eq('workshop_id', workshopId)
      );

    // 2. Delete milestones
    await supabase
      .from('milestones')
      .delete()
      .eq('workshop_id', workshopId);

    // 3. Delete chat messages
    await supabase
      .from('chat_messages')
      .delete()
      .eq('workshop_id', workshopId);

    // 4. Delete attendees
    await supabase
      .from('attendees')
      .delete()
      .eq('workshop_id', workshopId);

    // 5. Update workshop status to completed
    await supabase
      .from('workshops')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', workshopId);

    return NextResponse.json({ 
      success: true,
      message: 'Workshop terminated and all related data deleted'
    });
  } catch (error) {
    console.error('Error terminating workshop:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
