'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import type { CreateWorkshopResponse } from '@/lib/types'
import WalletConnectButton from '@/components/WalletConnectButton'
import { LoadingButton } from '@/components/ui/loading-button'
import { LoadingBar } from '@/components/ui/loading-bar'

export default function CreateWorkshopPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    hostName: '',
    hostEmail: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !address) {
      setError('Please connect your wallet first')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Client-side disposable email check
      const { validateEmail: checkEmail } = await import('@/lib/validateEmail')
      const emailError = checkEmail(formData.hostEmail)
      if (emailError) {
        setError(emailError)
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/workshop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          hostWallet: address,
          hostName: formData.hostName,
          hostEmail: formData.hostEmail
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create workshop')
      }

      const data: CreateWorkshopResponse = await response.json()

      // Redirect to the workshop page
      router.push(`/workshop/${data.workshop.session_code}?host=true`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{ ['--accent' as string]: '#2f6df6' }}
    >
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <Link href="/" className="neo-link text-sm">
            &lt;- Back to Home
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Create Workshop
          </h1>
          <p className="neo-muted">Host a new Web3 workshop session.</p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center">
          <WalletConnectButton />
        </div>

        {isConnected && address && (
          <form
            onSubmit={handleSubmit}
            className="relative space-y-4 neo-panel p-6 overflow-hidden"
          >
            <LoadingBar isLoading={isLoading} />
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100"
              >
                Workshop Title *
              </label>
              <input
                id="title"
                type="text"
                required
                value={formData.title}
                onChange={e =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="neo-input"
                placeholder="e.g., Intro to DeFi"
              />
            </div>

            <div>
              <label
                htmlFor="hostName"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100"
              >
                Your Name *
              </label>
              <input
                id="hostName"
                type="text"
                required
                value={formData.hostName}
                onChange={e =>
                  setFormData({ ...formData, hostName: e.target.value })
                }
                className="neo-input"
                placeholder="e.g., John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="hostEmail"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100"
              >
                Email *
              </label>
              <input
                id="hostEmail"
                type="email"
                required
                value={formData.hostEmail}
                onChange={e =>
                  setFormData({ ...formData, hostEmail: e.target.value })
                }
                className="neo-input"
                placeholder="your.email@example.com"
              />
              <p className="text-xs neo-muted mt-1">
                Temporary/disposable emails are not allowed
              </p>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100"
              >
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="neo-input min-h-[110px] resize-none"
                placeholder="Brief description of your workshop..."
              />
            </div>

            <div className="p-3 neo-surface">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <strong>Connected Wallet:</strong> {address.slice(0, 6)}...
                {address.slice(-4)}
              </p>
            </div>

            {error && (
              <div className="p-3 neo-surface text-red-600 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Creating Workshop..."
              className="w-full py-3"
            >
              Create Workshop
            </LoadingButton>
          </form>
        )}

        {isConnected && (
          <div className="text-center text-sm neo-muted">
            <p>After creating, you'll receive a QR code and session code</p>
            <p>to share with your attendees</p>
          </div>
        )}
      </div>
    </div>
  )
}
