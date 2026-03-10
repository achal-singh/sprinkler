import { type Address, type Hex } from 'viem'

// ---------------------------------------------------------------------------
// Contract address
// ---------------------------------------------------------------------------

export const BATCH_TRANSFER_ADDRESS = (process.env.NEXT_PUBLIC_BATCH_TRANSFER_ADDRESS ?? '') as Address

// ---------------------------------------------------------------------------
// ABI — only the functions & events we actually call from the frontend
// ---------------------------------------------------------------------------

export const batchTransferABI = [
  // ---- Functions ----
  {
    name: 'batchTransferETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'batchTransferERC20',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTokenBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // ---- Events ----
  {
    name: 'BatchETHTransfer',
    type: 'event',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'BatchERC20Transfer',
    type: 'event',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'recipientCount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TransferFailed',
    type: 'event',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },

  // ---- Errors ----
  { name: 'InvalidArrayLength', type: 'error', inputs: [] },
  { name: 'InsufficientBalance', type: 'error', inputs: [] },
  { name: 'ArrayLengthMismatch', type: 'error', inputs: [] },
  { name: 'TransferFailedError', type: 'error', inputs: [] },
  { name: 'ZeroAddress', type: 'error', inputs: [] },
] as const

// ---------------------------------------------------------------------------
// EIP-7702 delegation helpers
// ---------------------------------------------------------------------------

/** EIP-7702 delegation designator prefix (3 bytes) */
const EIP_7702_PREFIX = '0xef0100'

export type DelegationStatus =
  | { kind: 'none' }                                      // regular EOA, no code
  | { kind: 'delegated-batch-transfer' }                   // delegated to our contract
  | { kind: 'delegated-other'; address: Address }          // delegated to a different contract
  | { kind: 'contract' }                                   // regular smart contract

/**
 * Inspect the on-chain code at an address and determine its EIP-7702
 * delegation status relative to our BatchTransfer contract.
 */
export function checkDelegationStatus(code: Hex): DelegationStatus {
  if (code === '0x') {
    return { kind: 'none' }
  }

  if (code.startsWith(EIP_7702_PREFIX)) {
    const delegateAddress = ('0x' + code.slice(EIP_7702_PREFIX.length)) as Address

    if (delegateAddress.toLowerCase() === BATCH_TRANSFER_ADDRESS.toLowerCase()) {
      return { kind: 'delegated-batch-transfer' }
    }

    return { kind: 'delegated-other', address: delegateAddress }
  }

  return { kind: 'contract' }
}

// ---------------------------------------------------------------------------
// Payment types — discriminated union to support future token types
// ---------------------------------------------------------------------------

export type PaymentToken =
  | { type: 'native' }
  | { type: 'erc20'; address: Address; symbol: string; decimals: number }
  // Future extensions:
  // | { type: 'erc721'; address: Address; tokenIds: bigint[] }
  // | { type: 'erc1155'; address: Address; tokenId: bigint }

export interface PaymentRecipient {
  attendeeId: string
  address: Address
  displayName: string | null
  amount: string // human-readable amount (e.g. "0.01")
  selected: boolean
}

export interface PaymentSummary {
  token: PaymentToken
  recipients: PaymentRecipient[]
  totalAmount: bigint
  recipientCount: number
}
