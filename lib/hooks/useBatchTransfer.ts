'use client'

import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { type Address, type Hex, encodeFunctionData } from 'viem'
import {
  BATCH_TRANSFER_ADDRESS,
  batchTransferABI,
  checkDelegationStatus,
  type DelegationStatus,
  type PaymentToken
} from '@/lib/contracts/batchTransfer'

// ---------------------------------------------------------------------------
// useDelegationStatus — check if the connected EOA is already delegated
// ---------------------------------------------------------------------------

export function useDelegationStatus() {
  const { address } = useAccount()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<DelegationStatus | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const check = useCallback(async () => {
    if (!address || !publicClient) return null

    setIsChecking(true)
    try {
      const code = await publicClient.getCode({ address })
      const result = checkDelegationStatus((code ?? '0x') as Hex)
      setStatus(result)
      return result
    } catch (err) {
      console.error('Failed to check delegation status:', err)
      setStatus({ kind: 'none' })
      return { kind: 'none' } as DelegationStatus
    } finally {
      setIsChecking(false)
    }
  }, [address, publicClient])

  return { status, isChecking, check }
}

// ---------------------------------------------------------------------------
// useBatchTransfer — the main hook for executing batch payments
// ---------------------------------------------------------------------------

export type TransferStep =
  | 'idle'
  | 'checking-delegation'
  | 'signing-authorization'
  | 'sending-transaction'
  | 'confirming'
  | 'success'
  | 'error'

export interface BatchTransferResult {
  txHash: string | null
  error: string | null
}

export function useBatchTransfer() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

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
      if (!address || !walletClient || !publicClient) {
        const msg = 'Wallet not connected'
        setError(msg)
        setStep('error')
        return { txHash: null, error: msg }
      }

      if (!BATCH_TRANSFER_ADDRESS) {
        const msg = 'BatchTransfer contract address not configured'
        setError(msg)
        setStep('error')
        return { txHash: null, error: msg }
      }

      try {
        setError(null)
        setTxHash(null)

        // 1. Check current delegation status
        setStep('checking-delegation')
        const code = await publicClient.getCode({ address })
        const delegation = checkDelegationStatus((code ?? '0x') as Hex)

        const needsAuthorization =
          delegation.kind !== 'delegated-batch-transfer'

        let authorizationList: any[] | undefined

        if (needsAuthorization) {
          // 2. Prepare/sign EIP-7702 authorization.
          // viem `signAuthorization` does not support json-rpc accounts
          // (e.g. MetaMask injected wallets), so for those we pass an
          // unsigned authorization in the tx and let the wallet handle it.
          if (walletClient.account?.type === 'json-rpc') {
            const authorization = await walletClient.prepareAuthorization({
              account: address,
              executor: 'self',
              contractAddress: BATCH_TRANSFER_ADDRESS
            })
            authorizationList = [authorization]
          } else {
            setStep('signing-authorization')
            const authorization = await walletClient.signAuthorization({
              executor: 'self',
              contractAddress: BATCH_TRANSFER_ADDRESS
            })
            authorizationList = [authorization]
          }
        }
        // walletClient.sen

        // 3. Send the batch transfer transaction
        setStep('sending-transaction')

        let hash: Hex

        if (token.type === 'native') {
          const totalValue = amounts.reduce((sum, a) => sum + a, 0n)

          hash = await walletClient.writeContract({
            abi: batchTransferABI,
            address: address, // EIP-7702: call the EOA itself
            functionName: 'batchTransferETH',
            args: [recipients, amounts],
            value: totalValue,
            ...(authorizationList ? { authorizationList, type: 'eip7702' } : {})
          })
        } else if (token.type === 'erc20') {
          // hash = await walletClient.writeContract({
          //   abi: batchTransferABI,
          //   address: address, // EIP-7702: call the EOA itself
          //   functionName: 'batchTransferERC20',
          //   args: [token.address, recipients, amounts],
          //   ...(authorizationList ? { authorizationList, type: 'eip7702' } : {}),
          // })
          console.log('REACHED HERE!!!!')
          const data = encodeFunctionData({
            abi: batchTransferABI,
            functionName: 'batchTransferERC20',
            args: [token.address, recipients, amounts]
          })

          const tx = {
            account: address, // from
            to: address, // EIP-7702 self-call
            data,
            // value: 0n, // ERC20 transfer call is nonpayable
            ...(authorizationList
              ? { authorizationList, /* type: 'eip7702' as const */ }
              : {})
          }

          // signs + broadcasts via wallet

          hash = await walletClient.sendTransaction(tx)
        } else {
          throw new Error(`Unsupported token type`)
        }

        // 4. Wait for confirmation
        setStep('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted')
        }

        setTxHash(hash)
        setStep('success')
        return { txHash: hash, error: null }
      } catch (err: any) {
        const rawMsg = err?.shortMessage ?? err?.message ?? 'Transaction failed'
        const lower = String(rawMsg).toLowerCase()
        const isInvalidParams =
          lower.includes('invalid parameters') ||
          lower.includes('invalid params')
        const msg =
          isInvalidParams && lower.includes('rpc')
            ? 'Wallet rejected EIP-7702 transaction parameters. Please update/switch wallet or network to one that supports EIP-7702 (type 0x4).'
            : rawMsg
        setError(msg)
        setStep('error')
        return { txHash: null, error: msg }
      }
    },
    [address, walletClient, publicClient]
  )

  return { step, txHash, error, execute, reset }
}
