'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useBalance, usePublicClient } from 'wagmi'
import {
  parseUnits,
  formatEther,
  formatUnits,
  type Address,
  isAddress,
  erc20Abi
} from 'viem'
import Link from 'next/link'

import { supabase } from '@/lib/supabase'
import { truncateAddress } from '@/lib/utils'
import type { Workshop, Attendee, Milestone } from '@/lib/types'
import type {
  PaymentToken,
  PaymentRecipient
} from '@/lib/contracts/batchTransfer'
import {
  useBatchTransfer,
  type TransferStep
} from '@/lib/hooks/useBatchTransfer'

import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { Spinner } from '@/components/ui/spinner'
import WalletConnectButton from '@/components/WalletConnectButton'
import { ArrowLeft, CheckCircle2, ExternalLink, Wallet } from 'lucide-react'

// ---------------------------------------------------------------------------
// Step indicator labels for the transaction flow
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<TransferStep, string> = {
  idle: '',
  'sending-transaction': 'Confirm the batch transfer in your wallet...',
  confirming: 'Waiting for on-chain confirmation...',
  success: 'Transfer complete!',
  error: 'Transfer failed'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = params.sessionId as string

  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // ---- Data loading ----
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [completions, setCompletions] = useState<Map<string, Set<string>>>(
    new Map()
  )
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // ---- Token selection ----
  const [tokenType, setTokenType] = useState<'native' | 'erc20'>('native')
  const [erc20Address, setErc20Address] = useState('')
  const [erc20Info, setErc20Info] = useState<{
    symbol: string
    decimals: number
    balance: bigint
  } | null>(null)
  const [erc20Loading, setErc20Loading] = useState(false)
  const [erc20Error, setErc20Error] = useState('')

  // ---- Native balance ----
  const { data: nativeBalance } = useBalance({ address })

  // ---- Recipients ----
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([])
  const [uniformAmount, setUniformAmount] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState<string>('all')

  // ---- Batch transfer ----
  const {
    step,
    txHash,
    error: txError,
    execute,
    reset: resetTx
  } = useBatchTransfer()

  // -----------------------------------------------------------------------
  // Load workshop data
  // -----------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      try {
        setPageLoading(true)

        const { data: ws, error: wsErr } = await supabase
          .from('workshops')
          .select('*')
          .eq('session_code', sessionCode.toUpperCase())
          .single()

        if (wsErr || !ws) throw new Error('Workshop not found')
        setWorkshop(ws)

        // Auth check — only the host may access
        if (
          !address ||
          address.toLowerCase() !== ws.host_wallet.toLowerCase()
        ) {
          router.push(`/workshop/${sessionCode}`)
          return
        }

        // Fetch attendees
        const { data: att } = await supabase
          .from('attendees')
          .select('*')
          .eq('workshop_id', ws.id)
          .order('joined_at', { ascending: true })
        if (att) setAttendees(att)

        // Fetch milestones
        const { data: ms } = await supabase
          .from('milestones')
          .select('*')
          .eq('workshop_id', ws.id)
          .order('order_index', { ascending: true })
        if (ms) setMilestones(ms)

        // Fetch completions
        if (ms && ms.length > 0) {
          const { data: comps } = await supabase
            .from('milestone_completions')
            .select('milestone_id, attendee_id')
            .in(
              'milestone_id',
              ms.map(m => m.id)
            )

          if (comps) {
            const map = new Map<string, Set<string>>()
            comps.forEach(c => {
              if (!map.has(c.milestone_id)) map.set(c.milestone_id, new Set())
              map.get(c.milestone_id)!.add(c.attendee_id)
            })
            setCompletions(map)
          }
        }

        setPageLoading(false)
      } catch (err: any) {
        setPageError(err.message ?? 'Failed to load')
        setPageLoading(false)
      }
    }

    if (address) load()
  }, [address, sessionCode, router])

  // -----------------------------------------------------------------------
  // Initialize recipients from attendees
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (attendees.length === 0) return
    setRecipients(
      attendees.map(a => ({
        attendeeId: a.id,
        address: a.wallet_address as Address,
        displayName: a.display_name,
        amount: uniformAmount || '',
        selected: true
      }))
    )
  }, [attendees])

  // -----------------------------------------------------------------------
  // ERC-20 token detection
  // -----------------------------------------------------------------------

  const fetchErc20Info = useCallback(async () => {
    if (!isAddress(erc20Address) || !publicClient || !address) {
      setErc20Info(null)
      return
    }

    setErc20Loading(true)
    setErc20Error('')
    try {
      const [symbol, decimals, balance] = await Promise.all([
        publicClient.readContract({
          address: erc20Address as Address,
          abi: erc20Abi,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: erc20Address as Address,
          abi: erc20Abi,
          functionName: 'decimals'
        }),
        publicClient.readContract({
          address: erc20Address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address]
        })
      ])
      setErc20Info({
        symbol: symbol as string,
        decimals: Number(decimals),
        balance: balance as bigint
      })
    } catch {
      setErc20Error(
        'Could not read token info. Is this a valid ERC-20 address?'
      )
      setErc20Info(null)
    } finally {
      setErc20Loading(false)
    }
  }, [erc20Address, publicClient, address])

  useEffect(() => {
    if (tokenType === 'erc20' && erc20Address.length === 42) {
      fetchErc20Info()
    }
  }, [erc20Address, tokenType, fetchErc20Info])

  // -----------------------------------------------------------------------
  // Milestone filter logic
  // -----------------------------------------------------------------------

  const filteredRecipients = useMemo(() => {
    if (milestoneFilter === 'all') return recipients

    return recipients.map(r => {
      const completedSet = completions.get(milestoneFilter)
      const hasCompleted = completedSet?.has(r.attendeeId) ?? false
      return { ...r, selected: hasCompleted }
    })
  }, [recipients, milestoneFilter, completions])

  // -----------------------------------------------------------------------
  // "Set All" — apply uniform amount to all selected recipients
  // -----------------------------------------------------------------------

  const applyUniformAmount = useCallback(() => {
    setRecipients(prev => prev.map(r => ({ ...r, amount: uniformAmount })))
  }, [uniformAmount])

  const toggleRecipient = useCallback((attendeeId: string) => {
    setRecipients(prev =>
      prev.map(r =>
        r.attendeeId === attendeeId ? { ...r, selected: !r.selected } : r
      )
    )
  }, [])

  const updateRecipientAmount = useCallback(
    (attendeeId: string, amount: string) => {
      setRecipients(prev =>
        prev.map(r => (r.attendeeId === attendeeId ? { ...r, amount } : r))
      )
    },
    []
  )

  const selectAll = useCallback((selected: boolean) => {
    setRecipients(prev => prev.map(r => ({ ...r, selected })))
  }, [])

  // -----------------------------------------------------------------------
  // Computed summary
  // -----------------------------------------------------------------------

  const activeRecipients = useMemo(
    () => filteredRecipients.filter(r => r.selected && r.amount),
    [filteredRecipients]
  )

  const decimals = tokenType === 'erc20' && erc20Info ? erc20Info.decimals : 18
  const symbol = tokenType === 'erc20' && erc20Info ? erc20Info.symbol : 'ETH'

  const totalAmount = useMemo(() => {
    try {
      return activeRecipients.reduce((sum, r) => {
        return sum + parseUnits(r.amount, decimals)
      }, BigInt(0))
    } catch {
      return BigInt(0)
    }
  }, [activeRecipients, decimals])

  const formattedTotal = formatUnits(totalAmount, decimals)

  // -----------------------------------------------------------------------
  // Execute transfer
  // -----------------------------------------------------------------------

  const handleSend = async () => {
    if (activeRecipients.length === 0) return

    const addresses = activeRecipients.map(r => r.address)
    const amounts = activeRecipients.map(r => parseUnits(r.amount, decimals))

    const token: PaymentToken =
      tokenType === 'native'
        ? { type: 'native' }
        : {
            type: 'erc20',
            address: erc20Address as Address,
            symbol: erc20Info!.symbol,
            decimals: erc20Info!.decimals
          }

    await execute(token, addresses, amounts)
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const isTransacting = ['sending-transaction', 'confirming'].includes(step)
  const canSend =
    activeRecipients.length > 0 && totalAmount > BigInt(0) && !isTransacting

  // -----------------------------------------------------------------------
  // Loading / error states
  // -----------------------------------------------------------------------

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neo-panel p-6 text-center">
          <Spinner size="lg" className="mx-auto text-[color:var(--accent)]" />
          <p className="mt-4 neo-muted">Loading payment dashboard...</p>
        </div>
      </div>
    )
  }

  if (pageError || !workshop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neo-panel p-6 text-center space-y-4">
          <p className="text-red-600 dark:text-red-400">
            {pageError || 'Workshop not found'}
          </p>
          <Link
            href={`/workshop/${sessionCode}?host=true`}
            className="neo-link inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to workshop
          </Link>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen" style={{ ['--accent' as string]: '#2f6df6' }}>
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-8">
        <div className="neo-panel px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/workshop/${sessionCode}?host=true`}
                className="neo-link inline-flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm">Back to Workshop</span>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Send Funds — {workshop.title}
                </h1>
                <p className="text-sm neo-muted">
                  Batch transfer to workshop attendees
                </p>
              </div>
            </div>
            <WalletConnectButton />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ============================================================= */}
        {/*  Panel 1: Token Selection                                      */}
        {/* ============================================================= */}
        <div className="neo-panel p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Token</h2>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setTokenType('native')
                setErc20Error('')
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tokenType === 'native'
                  ? 'neo-button'
                  : 'neo-button neo-button--ghost'
              }`}
            >
              ETH
            </button>
            <button
              onClick={() => setTokenType('erc20')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tokenType === 'erc20'
                  ? 'neo-button'
                  : 'neo-button neo-button--ghost'
              }`}
            >
              ERC-20
            </button>
          </div>

          {tokenType === 'erc20' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Token Contract Address
              </label>
              <input
                type="text"
                value={erc20Address}
                onChange={e => setErc20Address(e.target.value.trim())}
                placeholder="0x..."
                className="neo-input font-mono text-sm"
              />
              {erc20Loading && (
                <div className="flex items-center gap-2 text-sm neo-muted">
                  <Spinner size="sm" /> Fetching token info...
                </div>
              )}
              {erc20Error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {erc20Error}
                </p>
              )}
              {erc20Info && (
                <div className="p-3 neo-surface text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {erc20Info.symbol}
                  </span>
                  <span className="neo-muted ml-2">
                    ({erc20Info.decimals} decimals)
                  </span>
                  <span className="neo-muted ml-2">
                    Balance:{' '}
                    {formatUnits(erc20Info.balance, erc20Info.decimals)}
                  </span>
                </div>
              )}
            </div>
          )}

          {tokenType === 'native' && nativeBalance && (
            <div className="text-sm neo-muted">
              Wallet balance:{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {parseFloat(formatEther(nativeBalance.value)).toFixed(4)} ETH
              </span>
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/*  Panel 2: Recipients                                           */}
        {/* ============================================================= */}
        <div className="neo-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recipients
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectAll(true)}
                className="text-xs neo-link"
              >
                Select all
              </button>
              <button
                onClick={() => selectAll(false)}
                className="text-xs neo-muted hover:text-[color:var(--accent)]"
              >
                Deselect all
              </button>
            </div>
          </div>

          {/* Milestone filter */}
          {milestones.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium neo-muted">
                Filter by milestone:
              </span>
              <button
                onClick={() => setMilestoneFilter('all')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  milestoneFilter === 'all'
                    ? 'neo-pill text-[color:var(--accent)]'
                    : 'neo-pill'
                }`}
              >
                All
              </button>
              {milestones.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setMilestoneFilter(m.id)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    milestoneFilter === m.id
                      ? 'neo-pill text-[color:var(--accent)]'
                      : 'neo-pill'
                  }`}
                >
                  #{i + 1} {m.title}
                </button>
              ))}
            </div>
          )}

          {/* Uniform amount quick-set */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={uniformAmount}
              onChange={e => setUniformAmount(e.target.value)}
              placeholder={`Amount per recipient (${symbol})`}
              className="neo-input flex-1 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={applyUniformAmount}
              disabled={!uniformAmount}
            >
              Set All
            </Button>
          </div>

          {/* Recipient table */}
          {filteredRecipients.length === 0 ? (
            <p className="text-center neo-muted py-6">
              No attendees in this workshop yet.
            </p>
          ) : (
            <div className="neo-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--surface-2)] text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium neo-muted w-10"></th>
                    <th className="px-4 py-2 font-medium neo-muted">
                      Attendee
                    </th>
                    <th className="px-4 py-2 font-medium neo-muted">
                      Wallet
                    </th>
                    <th className="px-4 py-2 font-medium neo-muted">
                      Milestones
                    </th>
                    <th className="px-4 py-2 font-medium neo-muted text-right">
                      Amount ({symbol})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--surface-border)]">
                  {filteredRecipients.map(r => {
                    const completedCount = milestones.filter(m =>
                      completions.get(m.id)?.has(r.attendeeId)
                    ).length

                    return (
                      <tr
                        key={r.attendeeId}
                        className={`transition-colors ${r.selected ? 'bg-transparent' : 'bg-[color:var(--surface-2)] opacity-60'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={() => toggleRecipient(r.attendeeId)}
                            className="rounded border-[color:var(--surface-border)]"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          {r.displayName || 'Anonymous'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs neo-muted">
                          {truncateAddress(r.address)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs neo-muted">
                            {completedCount}/{milestones.length}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={r.amount}
                            onChange={e =>
                              updateRecipientAmount(
                                r.attendeeId,
                                e.target.value
                              )
                            }
                            disabled={!r.selected}
                            placeholder="0.0"
                            className="neo-input w-full text-right px-2 py-1 text-sm disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/*  Panel 3: Review & Send (sticky)                               */}
        {/* ============================================================= */}
        <div className="sticky bottom-0 neo-panel p-5 space-y-3">
          <LoadingBar isLoading={isTransacting} className="rounded-t-lg" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm neo-muted">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formattedTotal} {symbol}
              </p>
              <p className="text-xs neo-muted">
                to {activeRecipients.length}{' '}
                {activeRecipients.length === 1 ? 'recipient' : 'recipients'}
              </p>
            </div>

            <LoadingButton
              isLoading={isTransacting}
              loadingText={STEP_LABELS[step]}
              onClick={handleSend}
              disabled={!canSend}
              className="px-8 py-3 text-base"
              size="lg"
            >
              <Wallet className="h-5 w-5 mr-2" />
              Review & Send
            </LoadingButton>
          </div>

          {/* Step indicator */}
          {isTransacting && (
            <div className="flex items-center gap-2 text-sm text-[color:var(--accent)]">
              <Spinner size="sm" />
              {STEP_LABELS[step]}
            </div>
          )}

          {/* Success */}
          {step === 'success' && txHash && (
            <div className="p-3 neo-surface border border-green-200 dark:border-green-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                Transfer confirmed!
              </div>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 dark:text-green-300 hover:underline inline-flex items-center gap-1"
              >
                View on Etherscan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Error */}
          {step === 'error' && txError && (
            <div className="p-3 neo-surface border border-red-200 dark:border-red-800 rounded-2xl space-y-2">
              <p className="text-sm text-red-700 dark:text-red-300">
                {txError}
              </p>
              <button
                onClick={resetTx}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Dismiss & try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
