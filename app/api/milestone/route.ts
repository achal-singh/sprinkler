import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import { CreateMilestoneRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateMilestoneRequest = await request.json();
    const { workshopId, title, description, hostWallet } = body;

    if (!workshopId || !title || !hostWallet) {
      return NextResponse.json(
        { error: 'Workshop ID, title, and host wallet are required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Verify workshop exists and user is host
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

    // Get current max order_index
    const { data: milestones } = await supabase
      .from('milestones')
      .select('order_index')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = milestones && milestones.length > 0 
      ? milestones[0].order_index + 1 
      : 0;

    // Create milestone
    const { data: milestone, error } = await supabase
      .from('milestones')
      .insert({
        id: generateId(),
        workshop_id: workshopId,
        title,
        description: description || null,
        order_index: nextOrderIndex,
        created_by: hostWallet,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create milestone:', error);
      return NextResponse.json(
        { error: 'Failed to create milestone' },
        { status: 500 }
      );
    }

    // Send system message
    await supabase.from('chat_messages').insert({
      id: generateId(),
      workshop_id: workshopId,
      sender_wallet: 'system',
      sender_name: 'System',
      message: `New milestone created: ${title}`,
      message_type: 'milestone_created',
    });

    return NextResponse.json({ milestone });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
