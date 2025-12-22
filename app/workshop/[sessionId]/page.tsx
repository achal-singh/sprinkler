'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatBox from '@/components/ChatBox';
import MilestoneList from '@/components/MilestoneList';
import AttendeeList from '@/components/AttendeeList';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import type { Workshop, Attendee, Milestone, ChatMessage } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function WorkshopSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sessionCode = params.sessionId as string;
  const isHost = searchParams.get('host') === 'true';
  const attendeeId = searchParams.get('attendee');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [completions, setCompletions] = useState<Map<string, Set<string>>>(new Map());
  
  const [currentUser, setCurrentUser] = useState<Attendee | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchWorkshopData();
  }, [sessionCode]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!workshop) return;

    const attendeesChannel = supabase
      .channel(`workshop-${workshop.id}-attendees`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendees', filter: `workshop_id=eq.${workshop.id}` },
        (payload) => {
          // Refetch with the current workshop ID
          fetchAttendees(workshop.id);
        }
      )
      .subscribe((status) => {
        console.info('Attendees channel status:', status);
      });

    const milestonesChannel = supabase
      .channel(`workshop-${workshop.id}-milestones`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `workshop_id=eq.${workshop.id}` },
        () => fetchMilestones()
      )
      .subscribe();

    const completionsChannel = supabase
      .channel(`workshop-${workshop.id}-completions`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'milestone_completions' },
        () => fetchCompletions()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel(`workshop-${workshop.id}-messages`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `workshop_id=eq.${workshop.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendeesChannel);
      supabase.removeChannel(milestonesChannel);
      supabase.removeChannel(completionsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [workshop]);

  const fetchWorkshopData = async () => {
    try {
      setLoading(true);
      
      // Fetch workshop
      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('session_code', sessionCode.toUpperCase())
        .single();

      if (workshopError) throw workshopError;
      if (!workshopData) throw new Error('Workshop not found');

      setWorkshop(workshopData);
      
      // Generate QR code and join URL if host
      if (isHost) {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/workshop/join?code=${sessionCode}`;
        setJoinUrl(url);
        
        const qrResponse = await fetch(`/api/workshop/qrcode?url=${encodeURIComponent(url)}`);
        const qrData = await qrResponse.json();
        setQrCodeUrl(qrData.qrCodeUrl);
      }

      // Fetch all related data
      await Promise.all([
        fetchAttendees(workshopData.id),
        fetchMilestones(workshopData.id),
        fetchMessages(workshopData.id),
        fetchCompletions(workshopData.id),
      ]);

      // Set current user if attendee
      if (attendeeId) {
        const { data: attendeeData } = await supabase
          .from('attendees')
          .select('*')
          .eq('id', attendeeId)
          .single();
        
        if (attendeeData) setCurrentUser(attendeeData);
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workshop');
      setLoading(false);
    }
  };

  const fetchAttendees = async (workshopId?: string) => {
    const id = workshopId || workshop?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('workshop_id', id)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching attendees:', error);
      return;
    }
    if (data) setAttendees(data);
  };

  const fetchMilestones = async (workshopId?: string) => {
    const id = workshopId || workshop?.id;
    if (!id) return;

    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('workshop_id', id)
      .order('order_index', { ascending: true });

    if (data) setMilestones(data);
  };

  const fetchMessages = async (workshopId?: string) => {
    const id = workshopId || workshop?.id;
    if (!id) return;

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('workshop_id', id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) setMessages(data);
  };

  const fetchCompletions = async (workshopId?: string) => {
    const id = workshopId || workshop?.id;
    if (!id) return;

    const { data } = await supabase
      .from('milestone_completions')
      .select('milestone_id, attendee_id')
      .in('milestone_id', milestones.map(m => m.id));

    if (data) {
      const completionsMap = new Map<string, Set<string>>();
      data.forEach((completion) => {
        if (!completionsMap.has(completion.milestone_id)) {
          completionsMap.set(completion.milestone_id, new Set());
        }
        completionsMap.get(completion.milestone_id)?.add(completion.attendee_id);
      });
      setCompletions(completionsMap);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!workshop || !currentUser) return;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId: workshop.id,
        senderWallet: currentUser.wallet_address,
        senderName: currentUser.display_name,
        message,
      }),
    });

    if (!response.ok) throw new Error('Failed to send message');
  };

  const handleCreateMilestone = async (title: string, description: string) => {
    if (!workshop) return;

    const response = await fetch('/api/milestone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId: workshop.id,
        title,
        description,
        hostWallet: workshop.host_wallet,
      }),
    });

    if (!response.ok) throw new Error('Failed to create milestone');
    await fetchMilestones();
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!currentUser) return;

    const response = await fetch('/api/milestone/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneId,
        attendeeId: currentUser.id,
      }),
    });

    if (!response.ok) throw new Error('Failed to complete milestone');
    await fetchCompletions();
  };

  const handleLeaveWorkshop = async () => {
    if (!currentUser || !workshop) return;

    try {
      // Send a leave message first (optional but helpful)
      await supabase.from('chat_messages').insert({
        id: generateId(),
        workshop_id: workshop.id,
        sender_wallet: 'system',
        sender_name: 'System',
        message: `${currentUser.display_name || currentUser.wallet_address.slice(0, 6)} left the workshop`,
        message_type: 'system',
      });

      // Delete the attendee record from the database
      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error deleting attendee:', error);
      }

      // Small delay to ensure the deletion is processed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Redirect to home
      router.push('/');
    } catch (error) {
      console.error('Error leaving workshop:', error);
      // Redirect anyway even if delete fails
      router.push('/');
    }
  };

  const handleTerminateWorkshop = async () => {
    if (!workshop) return;

    try {
      const response = await fetch('/api/workshop/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: workshop.id,
          hostWallet: workshop.host_wallet,
        }),
      });

      if (!response.ok) throw new Error('Failed to terminate workshop');

      // Redirect to home
      router.push('/');
    } catch (err) {
      alert('Failed to terminate workshop');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading workshop...</p>
        </div>
      </div>
    );
  }

  if (error || !workshop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Workshop not found'}</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{workshop.title}</h1>
              {workshop.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {workshop.description}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {isHost ? (
                <button
                  onClick={() => setShowTerminateConfirm(true)}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  End Workshop
                </button>
              ) : (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Leave Workshop
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Confirmation Modal (for attendees) */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Leave Workshop?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You will be removed from this workshop. Your chat messages and milestone completions will remain in the history.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveWorkshop}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Yes, Leave Workshop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Confirmation Modal */}
      {showTerminateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">End Workshop?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete all attendees, chat messages, and milestones. 
              Only the workshop record will remain. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTerminateConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateWorkshop}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Yes, End Workshop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Sidebar - Attendees & QR (Host) or Milestones (Attendee) */}
          <div className="lg:col-span-1 space-y-4">
            {isHost ? (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <QRCodeDisplay
                    qrCodeUrl={qrCodeUrl}
                    sessionCode={sessionCode}
                    joinUrl={joinUrl}
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <AttendeeList
                    attendees={attendees}
                    milestones={milestones}
                    completions={completions}
                    hostWallet={workshop.host_wallet}
                  />
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 h-[600px] overflow-y-auto">
                <MilestoneList
                  milestones={milestones}
                  completions={completions}
                  currentAttendeeId={currentUser?.id}
                  isHost={false}
                  onCompleteMilestone={handleCompleteMilestone}
                />
              </div>
            )}
          </div>

          {/* Middle - Chat */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-[600px] flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Chat</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {currentUser && (
                  <ChatBox
                    workshopId={workshop.id}
                    currentUserWallet={currentUser.wallet_address}
                    currentUserName={currentUser.display_name || undefined}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Milestones (Host) or Attendees (Attendee) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 h-[600px] overflow-y-auto">
              {isHost ? (
                <MilestoneList
                  milestones={milestones}
                  completions={completions}
                  isHost={true}
                  onCreateMilestone={handleCreateMilestone}
                />
              ) : (
                <AttendeeList
                  attendees={attendees}
                  milestones={milestones}
                  completions={completions}
                  hostWallet={workshop.host_wallet}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
