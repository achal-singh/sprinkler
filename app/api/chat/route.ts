import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { generateId } from '@/lib/utils';
import { SendMessageRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const { workshopId, senderWallet, senderName, message } = body;

    if (!workshopId || !senderWallet || !message) {
      return NextResponse.json(
        { error: 'Workshop ID, sender wallet, and message are required' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Create message
    const { data: chatMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        id: generateId(),
        workshop_id: workshopId,
        sender_wallet: senderWallet,
        sender_name: senderName || null,
        message: message.trim(),
        message_type: 'text',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send message:', error);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: chatMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workshopId = searchParams.get('workshopId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!workshopId) {
      return NextResponse.json(
        { error: 'Workshop ID is required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
