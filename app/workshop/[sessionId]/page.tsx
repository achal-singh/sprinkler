'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import ChatBox from '@/components/ChatBox'
import MilestoneList from '@/components/MilestoneList'
import AttendeeList from '@/components/AttendeeList'
import QRCodeDisplay from '@/components/QRCodeDisplay'
import WalletConnectButton from '@/components/WalletConnectButton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { Workshop, Attendee, Milestone, ChatMessage } from '@/lib/types'
import { generateId, truncateAddress } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ChevronDown, LogOut, ArrowLeft } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export default function WorkshopSessionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { address } = useAccount()
  const latestFetchRequestId = useRef(0)

  const sessionCode = params.sessionId as string
  const isHost = searchParams.get('host') === 'true'
  const attendeeId = searchParams.get('attendee')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [completions, setCompletions] = useState<Map<string, Set<string>>>(
    new Map()
  )

  const [currentUser, setCurrentUser] = useState<Attendee | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [joinUrl, setJoinUrl] = useState('')
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const chatSender = isHost
    ? workshop
      ? { wallet: workshop.host_wallet, name: 'Host' as string | undefined }
      : null
    : currentUser
      ? {
          wallet: currentUser.wallet_address,
          name: currentUser.display_name || undefined
        }
      : null

  // Flag used by handleLeaveWorkshop to bypass beforeunload
  const isLeavingIntentionally = useRef(false)

  // Warn attendees when closing/refreshing the tab
  useEffect(() => {
    if (isHost || !currentUser) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLeavingIntentionally.current) return
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isHost, currentUser])

  // Intercept browser back for attendees and show the leave confirmation dialog.
  useEffect(() => {
    if (isHost || !attendeeId || isLeavingIntentionally.current) return

    const ensureBackGuardState = () => {
      const currentState = window.history.state || {}
      if (!currentState.sprinklerLeaveGuard) {
        window.history.pushState(
          { ...currentState, sprinklerLeaveGuard: true },
          '',
          window.location.href
        )
      }
    }

    ensureBackGuardState()

    const handlePopState = () => {
      if (isLeavingIntentionally.current) return
      setShowLeaveConfirm(true)
      ensureBackGuardState()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isHost, attendeeId])

  const fetchAttendees = async (workshopId?: string) => {
    const id = workshopId || workshop?.id
    if (!id) return

    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('workshop_id', id)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Error fetching attendees:', error)
      return
    }
    if (data) setAttendees(data)
  }

  const fetchMilestones = async (workshopId?: string): Promise<string[]> => {
    const id = workshopId || workshop?.id
    if (!id) return []

    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('workshop_id', id)
      .order('order_index', { ascending: true })

    if (data) {
      setMilestones(data)
      return data.map(m => m.id)
    }
    return []
  }

  const fetchMessages = async (workshopId?: string) => {
    const id = workshopId || workshop?.id
    if (!id) return

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('workshop_id', id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) setMessages(data)
  }

  const fetchCompletions = async (workshopId?: string, milestoneIds?: string[]) => {
    const id = workshopId || workshop?.id
    if (!id) return

    const idsToQuery = milestoneIds || milestones.map(m => m.id)
    
    if (idsToQuery.length === 0) {
      setCompletions(new Map())
      return
    }

    const { data } = await supabase
      .from('milestone_completions')
      .select('milestone_id, attendee_id')
      .in('milestone_id', idsToQuery)

    if (data) {
      const completionsMap = new Map<string, Set<string>>()
      data.forEach(completion => {
        if (!completionsMap.has(completion.milestone_id)) {
          completionsMap.set(completion.milestone_id, new Set())
        }
        completionsMap.get(completion.milestone_id)?.add(completion.attendee_id)
      })
      setCompletions(completionsMap)
    }
  }

  const fetchWorkshopData = useCallback(async () => {
    const requestId = ++latestFetchRequestId.current
    const isCurrentRequest = () => latestFetchRequestId.current === requestId

    try {
      setLoading(true)
      setError('')

      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('session_code', sessionCode.toUpperCase())
        .single()

      if (!isCurrentRequest()) return

      if (workshopError) throw workshopError
      if (!workshopData) throw new Error('Workshop not found')

      setWorkshop(workshopData)

      if (isHost) {
        if (!address) {
          setError('Please connect your wallet to access host view')
          setLoading(false)
          return
        }

        if (address.toLowerCase() !== workshopData.host_wallet.toLowerCase()) {
          console.warn('Unauthorized host access attempt - wallet mismatch')
          router.push(`/workshop/join?code=${sessionCode}`)
          return
        }
      }

      if (isHost) {
        const baseUrl = window.location.origin
        const url = `${baseUrl}/workshop/join?code=${sessionCode}`
        setJoinUrl(url)

        const qrResponse = await fetch(
          `/api/workshop/qrcode?url=${encodeURIComponent(url)}`
        )
        if (!isCurrentRequest()) return

        const qrData = await qrResponse.json()
        if (!isCurrentRequest()) return

        setQrCodeUrl(qrData.qrCodeUrl)
      }

      await Promise.all([
        fetchAttendees(workshopData.id),
        fetchMessages(workshopData.id)
      ])

      const milestoneIds = await fetchMilestones(workshopData.id)
      if (milestoneIds && milestoneIds.length > 0) {
        await fetchCompletions(workshopData.id, milestoneIds)
      }

      if (attendeeId) {
        const { data: attendeeData } = await supabase
          .from('attendees')
          .select('*')
          .eq('id', attendeeId)
          .single()

        if (!isCurrentRequest()) return

        if (attendeeData) setCurrentUser(attendeeData)
      }

      if (!isCurrentRequest()) return
      setLoading(false)
    } catch (err) {
      if (!isCurrentRequest()) return
      setError(err instanceof Error ? err.message : 'Failed to load workshop')
      setLoading(false)
    }
  }, [address, attendeeId, isHost, router, sessionCode])

  useEffect(() => {
    fetchWorkshopData()
  }, [fetchWorkshopData])

  useEffect(() => {
    if (!workshop) return

    const attendeesChannel = supabase
      .channel(`workshop-${workshop.id}-attendees`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendees',
          filter: `workshop_id=eq.${workshop.id}`
        },
        payload => {
          fetchAttendees(workshop.id)
        }
      )
      .subscribe(status => {
        console.info('Attendees channel status:', status)
      })

    const milestonesChannel = supabase
      .channel(`workshop-${workshop.id}-milestones`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'milestones',
          filter: `workshop_id=eq.${workshop.id}`
        },
        async () => {
          const milestoneIds = await fetchMilestones()
          if (milestoneIds && milestoneIds.length > 0) {
            await fetchCompletions(undefined, milestoneIds)
          }
        }
      )
      .subscribe()

    const completionsChannel = supabase
      .channel(`workshop-${workshop.id}-completions`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'milestone_completions' },
        () => {
          const currentMilestoneIds = milestones.map(m => m.id)
          if (currentMilestoneIds.length > 0) {
            fetchCompletions(undefined, currentMilestoneIds)
          }
        }
      )
      .subscribe()

    const messagesChannel = supabase
      .channel(`workshop-${workshop.id}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workshop_id=eq.${workshop.id}`
        },
        payload => {
          setMessages(prev => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(attendeesChannel)
      supabase.removeChannel(milestonesChannel)
      supabase.removeChannel(completionsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [workshop, milestones])

  const handleSendMessage = async (message: string) => {
    if (!workshop || !chatSender) return

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId: workshop.id,
        senderWallet: chatSender.wallet,
        senderName: chatSender.name,
        message
      })
    })

    if (!response.ok) throw new Error('Failed to send message')
  }

  const handleCreateMilestone = async (title: string, description: string) => {
    if (!workshop) return

    const response = await fetch('/api/milestone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workshopId: workshop.id,
        title,
        description,
        hostWallet: workshop.host_wallet
      })
    })

    if (!response.ok) throw new Error('Failed to create milestone')
    
    const milestoneIds = await fetchMilestones()
    if (milestoneIds && milestoneIds.length > 0) {
      await fetchCompletions(undefined, milestoneIds)
    }
  }

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!currentUser) return

    const response = await fetch('/api/milestone/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneId,
        attendeeId: currentUser.id
      })
    })

    if (!response.ok) throw new Error('Failed to complete milestone')
    
    const currentMilestoneIds = milestones.map(m => m.id)
    if (currentMilestoneIds.length > 0) {
      await fetchCompletions(undefined, currentMilestoneIds)
    }
  }

  const handleLeaveWorkshop = async () => {
    if (!currentUser || !workshop) return

    setIsLeaving(true)
    try {
      await supabase.from('chat_messages').insert({
        id: generateId(),
        workshop_id: workshop.id,
        sender_wallet: 'system',
        sender_name: 'System',
        message: `${
          currentUser.display_name || currentUser.wallet_address.slice(0, 6)
        } left the workshop`,
        message_type: 'system'
      })

      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', currentUser.id)

      if (error) {
        console.error('Error deleting attendee:', error)
      }

      await new Promise(resolve => setTimeout(resolve, 300))

      // Disable navigation guards before redirecting
      isLeavingIntentionally.current = true
      router.push('/')
    } catch (error) {
      console.error('Error leaving workshop:', error)
      isLeavingIntentionally.current = true
      router.push('/')
    }
  }

  const handleTerminateWorkshop = async () => {
    if (!workshop) return

    setIsTerminating(true)
    try {
      const response = await fetch('/api/workshop/terminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId: workshop.id,
          hostWallet: workshop.host_wallet
        })
      })

      if (!response.ok) throw new Error('Failed to terminate workshop')

      router.push('/')
    } catch (err) {
      setIsTerminating(false)
      alert('Failed to terminate workshop')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading workshop...
          </p>
        </div>
      </div>
    )
  }

  if (error || !workshop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || 'Workshop not found'}
          </p>
          {error?.includes('connect your wallet') && <WalletConnectButton />}
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const displayName = currentUser?.display_name || 
                       (currentUser?.wallet_address ? truncateAddress(currentUser.wallet_address) : 'User')

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isHost && (
                <button
                  onClick={() => router.push('/')}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span className="text-sm">Back</span>
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {workshop.title}
                </h1>
                {workshop.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {workshop.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isHost ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowTerminateConfirm(true)}
                  disabled={isTerminating}
                  className="inline-flex items-center gap-2"
                >
                  {isTerminating && <Spinner size="sm" />}
                  {isTerminating ? 'Ending...' : 'End Workshop'}
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      Hi {displayName}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        {currentUser?.email && (
                          <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                            {currentUser.email}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 cursor-pointer"
                      onClick={() => setShowLeaveConfirm(true)}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Leave Workshop
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Workshop Dialog (for attendees) */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Workshop?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be removed from this workshop. Your chat messages and
              milestone completions will remain in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveWorkshop}
              disabled={isLeaving}
              className="bg-orange-600 hover:bg-orange-700 inline-flex items-center gap-2"
            >
              {isLeaving && <Spinner size="sm" />}
              {isLeaving ? 'Leaving...' : 'Yes, Leave Workshop'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Workshop Dialog (for host) */}
      <AlertDialog
        open={showTerminateConfirm}
        onOpenChange={setShowTerminateConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Workshop?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all attendees, chat messages, and
              milestones. Only the workshop record will remain. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminateWorkshop}
              disabled={isTerminating}
              className="bg-red-600 hover:bg-red-700 inline-flex items-center gap-2"
            >
              {isTerminating && <Spinner size="sm" />}
              {isTerminating ? 'Ending...' : 'Yes, End Workshop'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white">
                  Chat
                </h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {chatSender && (
                  <ChatBox
                    workshopId={workshop.id}
                    currentUserWallet={chatSender.wallet}
                    currentUserName={chatSender.name}
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
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
