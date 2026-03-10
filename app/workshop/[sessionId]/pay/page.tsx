'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useBalance, usePublicClient } from 'wagmi'
import { parseEther, parseUnits, formatEther, formatUnits, type Address, isAddress, erc20Abi } from 'viem'
import Link from 'next/link'

import { supabase } from '@/lib/supabase'
import { truncateAddress } from '@/lib/utils'
import type { Workshop, Attendee, Milestone } from '@/lib/types'
import type { PaymentToken, PaymentRecipient } from '@/lib/contracts/batchTransfer'
import { BATCH_TRANSFER_ADDRESS } from '@/lib/contracts/batchTransfer'
import { useBatchTransfer, useDelegationStatus, type TransferStep } from '@/lib/hooks/useBatchTransfer'

import { Button } from '@/components/ui/button'
import { LoadingButton } from '@/components/ui/loading-button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { Spinner } from '@/components/ui/spinner'
import WalletConnectButton from '@/components/WalletConnectButton'
import { ArrowLeft, CheckCircle2, ExternalLink, Wallet, AlertTriangle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Step indicator labels for the transaction flow
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<TransferStep, string> = {
  idle: '',
  'checking-delegation': 'Checking delegation status...',
  'signing-authorization': 'Sign the EIP-7702 authorization in your wallet...',
  'sending-transaction': 'Confirm the batch transfer in your wallet...',
  confirming: 'Waiting for on-chain confirmation...',
  success: 'Transfer complete!',
  error: 'Transfer failed',
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
  const [completions, setCompletions] = useState<Map<string, Set<string>>>(new Map())
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // ---- Token selection ----
  const [tokenType, setTokenType] = useState<'native' | 'erc20'>('native')
  const [erc20Address, setErc20Address] = useState('')
  const [erc20Info, setErc20Info] = useState<{ symbol: string; decimals: number; balance: bigint } | null>(null)
  const [erc20Loading, setErc20Loading] = useState(false)
  const [erc20Error, setErc20Error] = useState('')

  // ---- Native balance ----
  const { data: nativeBalance } = useBalance({ address })

  // ---- Recipients ----
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([])
  const [uniformAmount, setUniformAmount] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState<string>('all') // 'all' or milestoneId

  // ---- Delegation ----
  const { status: delegationStatus, isChecking: isDelegationChecking, check: checkDelegation } = useDelegationStatus()

  // ---- Batch transfer ----
  const { step, txHash, error: txError, execute, reset: resetTx } = useBatchTransfer()

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
        if (!address || address.toLowerCase() !== ws.host_wallet.toLowerCase()) {
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
            .in('milestone_id', ms.map(m => m.id))

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
        selected: true,
      }))
    )
  }, [attendees]) // intentionally excluding uniformAmount — handled separately

  // -----------------------------------------------------------------------
  // Check delegation on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (isConnected) checkDelegation()
  }, [isConnected, checkDelegation])

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
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: erc20Address as Address,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
        publicClient.readContract({
          address: erc20Address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      ])
      setErc20Info({ symbol: symbol as string, decimals: Number(decimals), balance: balance as bigint })
    } catch {
      setErc20Error('Could not read token info. Is this a valid ERC-20 address?')
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

  // -----------------------------------------------------------------------
  // Toggle individual recipient
  // -----------------------------------------------------------------------

  const toggleRecipient = useCallback((attendeeId: string) => {
    setRecipients(prev =>
      prev.map(r => (r.attendeeId === attendeeId ? { ...r, selected: !r.selected } : r))
    )
  }, [])

  // -----------------------------------------------------------------------
  // Update individual amount
  // -----------------------------------------------------------------------

  const updateRecipientAmount = useCallback((attendeeId: string, amount: string) => {
    setRecipients(prev =>
      prev.map(r => (r.attendeeId === attendeeId ? { ...r, amount } : r))
    )
  }, [])

  // -----------------------------------------------------------------------
  // Select / deselect all
  // -----------------------------------------------------------------------

  const selectAll = useCallback((selected: boolean) => {
    setRecipients(prev => prev.map(r => ({ ...r, selected })))
  }, [])

  // -----------------------------------------------------------------------
  // Computed summary
  // -----------------------------------------------------------------------

  const activeRecipients = useMemo(() => filteredRecipients.filter(r => r.selected && r.amount), [filteredRecipients])

  const decimals = tokenType === 'erc20' && erc20Info ? erc20Info.decimals : 18
  const symbol = tokenType === 'erc20' && erc20Info ? erc20Info.symbol : 'ETH'

  const totalAmount = useMemo(() => {
    try {
      return activeRecipients.reduce((sum, r) => {
        return sum + parseUnits(r.amount, decimals)
      }, 0n)
    } catch {
      return 0n
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
        : { type: 'erc20', address: erc20Address as Address, symbol: erc20Info!.symbol, decimals: erc20Info!.decimals }

    await execute(token, addresses, amounts)
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const isTransacting = ['checking-delegation', 'signing-authorization', 'sending-transaction', 'confirming'].includes(step)
  const canSend = activeRecipients.length > 0 && totalAmount > 0n && !isTransacting

  // -----------------------------------------------------------------------
  // Loading / error states
  // -----------------------------------------------------------------------

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading payment dashboard...</p>
        </div>
      </div>
    )
  }

  if (pageError || !workshop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 dark:text-red-400">{pageError || 'Workshop not found'}</p>
          <Link
            href={`/workshop/${sessionCode}?host=true`}
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-2"
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
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/workshop/${sessionCode}?host=true`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm">Back to Workshop</span>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Send Funds — {workshop.title}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Batch transfer to workshop attendees
                </p>
              </div>
            </div>
            <WalletConnectButton />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Delegation status banner */}
        {delegationStatus && delegationStatus.kind !== 'delegated-batch-transfer' && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Delegation required</p>
              <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                Your wallet is not yet delegated to the BatchTransfer contract. The first transfer will include an EIP-7702
                authorization signature. Subsequent transfers will execute directly.
              </p>
            </div>
          </div>
        )}

        {delegationStatus?.kind === 'delegated-batch-transfer' && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Wallet already delegated to BatchTransfer — no extra authorization step needed.
          </div>
        )}

        {/* ============================================================= */}
        {/*  Panel 1: Token Selection                                      */}
        {/* ============================================================= */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Token</h2>

          <div className="flex gap-2">
            <button
              onClick={() => { setTokenType('native'); setErc20Error('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tokenType === 'native'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              ETH
            </button>
            <button
              onClick={() => setTokenType('erc20')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tokenType === 'erc20'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              ERC-20
            </button>
          </div>

          {tokenType === 'erc20' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Token Contract Address
              </label>
              <input
                type="text"
                value={erc20Address}
                onChange={e => setErc20Address(e.target.value.trim())}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
              {erc20Loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Spinner size="sm" /> Fetching token info...
                </div>
              )}
              {erc20Error && <p className="text-sm text-red-600 dark:text-red-400">{erc20Error}</p>}
              {erc20Info && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{erc20Info.symbol}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    ({erc20Info.decimals} decimals)
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    Balance: {formatUnits(erc20Info.balance, erc20Info.decimals)}
                  </span>
                </div>
              )}
            </div>
          )}

          {tokenType === 'native' && nativeBalance && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Wallet balance: <span className="font-medium text-gray-900 dark:text-white">{parseFloat(formatEther(nativeBalance.value)).toFixed(4)} ETH</span>
            </div>
          )}
        </div>

        {/* ============================================================= */}
        {/*  Panel 2: Recipients                                           */}
        {/* ============================================================= */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Recipients</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => selectAll(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Select all
              </button>
              <button
                onClick={() => selectAll(false)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          {/* Milestone filter */}
          {milestones.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter by milestone:</span>
              <button
                onClick={() => setMilestoneFilter('all')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  milestoneFilter === 'all'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Button size="sm" variant="secondary" onClick={applyUniformAmount} disabled={!uniformAmount}>
              Set All
            </Button>
          </div>

          {/* Recipient table */}
          {filteredRecipients.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6">No attendees in this workshop yet.</p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 w-10"></th>
                    <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Attendee</th>
                    <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Wallet</th>
                    <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400">Milestones</th>
                    <th className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">
                      Amount ({symbol})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRecipients.map(r => {
                    const completedCount = milestones.filter(m => completions.get(m.id)?.has(r.attendeeId)).length

                    return (
                      <tr
                        key={r.attendeeId}
                        className={`transition-colors ${r.selected ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50 opacity-60'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={() => toggleRecipient(r.attendeeId)}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          {r.displayName || 'Anonymous'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                          {truncateAddress(r.address)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {completedCount}/{milestones.length}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={r.amount}
                            onChange={e => updateRecipientAmount(r.attendeeId, e.target.value)}
                            disabled={!r.selected}
                            placeholder="0.0"
                            className="w-full text-right px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 shadow-lg space-y-3">
          <LoadingBar isLoading={isTransacting} className="rounded-t-lg" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formattedTotal} {symbol}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                to {activeRecipients.length} {activeRecipients.length === 1 ? 'recipient' : 'recipients'}
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
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Spinner size="sm" />
              {STEP_LABELS[step]}
            </div>
          )}

          {/* Success */}
          {step === 'success' && txHash && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg flex items-center justify-between">
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
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg space-y-2">
              <p className="text-sm text-red-700 dark:text-red-300">{txError}</p>
              <button onClick={resetTx} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                Dismiss & try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
