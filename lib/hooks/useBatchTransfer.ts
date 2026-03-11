'use client'

import { useCallback, useState } from 'react'
import { useAccount } from 'wagmi'
import { type Address, erc20Abi } from 'viem'
import { sendCalls, getCallsStatus } from '@wagmi/core'
import { config } from '@/lib/wagmi'
import type { PaymentToken } from '@/lib/contracts/batchTransfer'

// ---------------------------------------------------------------------------
// useBatchTransfer — batch payments via wallet_sendCalls (EIP-5792)
// ---------------------------------------------------------------------------

export type TransferStep =
  | 'idle'
  | 'sending-transaction'
  | 'confirming'
  | 'success'
  | 'error'

export interface BatchTransferResult {
  txHash: string | null
  error: string | null
}

/** Poll interval (ms) when waiting for call bundle confirmation */
const POLL_INTERVAL = 2_000
/** Max time (ms) to wait before giving up on confirmation */
const POLL_TIMEOUT = 120_000

export function useBatchTransfer() {
  const { address } = useAccount()

  const [step, setStep] = useState<TransferStep>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('idle')
    setTxHash(null)
    setError(null)
  }, [])

  const execute = useCallback(
    async (
      token: PaymentToken,
      recipients: Address[],
      amounts: bigint[]
    ): Promise<BatchTransferResult> => {
      if (!address) {
        const msg = 'Wallet not connected'
        setError(msg)
        setStep('error')
        return { txHash: null, error: msg }
      }

      try {
        setError(null)
        setTxHash(null)

        // -----------------------------------------------------------------
        // Send the batch via wallet_sendCalls (EIP-5792)
        // -----------------------------------------------------------------
        setStep('sending-transaction')

        let batchId: string

        if (token.type === 'native') {
          // ETH: one simple value transfer per recipient
          const result = await sendCalls(config, {
            account: address,
            calls: recipients.map((to, i) => ({
              to,
              value: amounts[i]
            }))
          })
          batchId = result.id
        } else if (token.type === 'erc20') {
          // ERC-20: one transfer() call per recipient
          // No approval needed — under EIP-7702 the EOA *is* the sender
          const result = await sendCalls(config, {
            account: address,
            calls: recipients.map((to, i) => ({
              to: token.address,
              abi: erc20Abi,
              functionName: 'transfer' as const,
              args: [to, amounts[i]] as const
            }))
          })
          batchId = result.id
        } else {
          throw new Error('Unsupported token type')
        }

        // -----------------------------------------------------------------
        // Poll for confirmation
        // -----------------------------------------------------------------
        setStep('confirming')

        const startTime = Date.now()
        let hash: string | null = null

        while (Date.now() - startTime < POLL_TIMEOUT) {
          const status = await getCallsStatus(config, { id: batchId })

          if (status.status === 'success') {
            hash = status.receipts?.[0]?.transactionHash ?? batchId
            break
          }

          if (status.status === 'failure') {
            throw new Error('Batch transaction failed on-chain')
          }

          // Wait before next poll
          await new Promise(r => setTimeout(r, POLL_INTERVAL))
        }

        if (!hash) {
          throw new Error(
            'Transaction submitted but confirmation timed out. Check your wallet or block explorer for status.'
          )
        }

        setTxHash(hash)
        setStep('success')
        return { txHash: hash, error: null }
      } catch (err: any) {
        const msg = err?.shortMessage ?? err?.message ?? 'Transaction failed'
        setError(msg)
        setStep('error')
        return { txHash: null, error: msg }
      }
    },
    [address]
  )

  return { step, txHash, error, execute, reset }
}
