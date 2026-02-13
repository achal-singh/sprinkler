import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'

declare global {
  // Reuse wagmi config across module reloads to avoid duplicate WalletConnect core init.
  // eslint-disable-next-line no-var
  var __sprinklerWagmiConfig: ReturnType<typeof getDefaultConfig> | undefined
}

const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

if (!rawProjectId) {
  console.error(
    '[wagmi] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Set it in your environment variables.'
  )
}

const createWagmiConfig = () =>
  getDefaultConfig({
    appName: 'Sprinkler',
    projectId: rawProjectId,
    chains: [sepolia],
    ssr: true
  })

const globalForWagmi = globalThis as typeof globalThis & {
  __sprinklerWagmiConfig?: ReturnType<typeof getDefaultConfig>
}

export const config =
  globalForWagmi.__sprinklerWagmiConfig ?? createWagmiConfig()

globalForWagmi.__sprinklerWagmiConfig = config
