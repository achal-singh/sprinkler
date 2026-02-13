'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import Link from 'next/link';
import WalletConnectButton from '@/components/WalletConnectButton';

export default function JoinWorkshopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ reason?: string; existingWallet?: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    sessionCode: '',
    email: '',
    displayName: '',
  });

  // Pre-fill session code from URL if available
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setFormData(prev => ({ ...prev, sessionCode: codeFromUrl.toUpperCase() }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError('');
    setErrorDetails(null);
    setSuccessMessage('');

    if (!formData.sessionCode.match(/^[A-Z0-9]{6}$/)) {
      setError('Session code should be 6 characters (e.g., ABC123)');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/workshop/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to join workshop');
        setErrorDetails({ reason: data.reason, existingWallet: data.existingWallet });
        setIsLoading(false);
        return;
      }

      // Show success message briefly
      if (data.alreadyJoined) {
        if (data.reason === 'wallet') {
          setSuccessMessage('Rejoining with your wallet...');
        } else {
          setSuccessMessage('Welcome back!');
        }
      } else {
        setSuccessMessage(data.message || 'Joined successfully!');
      }

      // Small delay to show the success message
      setTimeout(() => {
        // Redirect to the workshop page
        router.push(`/workshop/${formData.sessionCode}?attendee=${data.attendee.id}`);
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <Link href="/" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold mt-4 text-gray-900 dark:text-white">Join Workshop</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Enter your session code to participate
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center">
          <WalletConnectButton />
        </div>

        {isConnected && address && (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div>
              <label htmlFor="sessionCode" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                Session Code *
              </label>
              <input
                id="sessionCode"
                type="text"
                required
                value={formData.sessionCode}
                onChange={(e) => setFormData({ ...formData, sessionCode: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl font-bold tracking-wider bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="ABC123"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Get this from your workshop host
              </p>
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                Display Name (Optional)
              </label>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Your name or nickname"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                Email (Optional)
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="your.email@example.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                If provided, this email must be unique for this workshop
              </p>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Connected Wallet:</strong> {address.slice(0, 6)}...{address.slice(-4)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                This wallet will be your unique identifier
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="text-red-800 dark:text-red-200 font-semibold text-sm">
                      {errorDetails?.reason === 'email' ? 'Email Already in Use' : 'Cannot Join Workshop'}
                    </p>
                    <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                      {error}
                    </p>
                  </div>
                </div>
                
                {errorDetails?.reason === 'email' && errorDetails?.existingWallet && (
                  <div className="pl-8 pt-2 border-t border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                      🔍 Details:
                    </p>
                    <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                      <li>• This email is registered with wallet: <code className="font-mono font-bold">{errorDetails.existingWallet}</code></li>
                      <li>• You are currently using: <code className="font-mono font-bold">{address.slice(0, 6)}...{address.slice(-4)}</code></li>
                    </ul>
                    <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/50 rounded border border-red-300 dark:border-red-700">
                      <p className="text-xs text-red-800 dark:text-red-200">
                        <strong>💡 What to do:</strong>
                      </p>
                      <ul className="text-xs text-red-700 dark:text-red-300 mt-1 space-y-1">
                        <li>1. Use a different email address, OR</li>
                        <li>2. Connect the wallet that originally used this email</li>
                      </ul>
                    </div>
                  </div>
                )}

                {errorDetails?.reason === 'wallet' && (
                  <div className="pl-8 pt-2 border-t border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Your wallet <code className="font-mono font-bold">{address.slice(0, 6)}...{address.slice(-4)}</code> has already joined this workshop.
                    </p>
                  </div>
                )}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                ✓ {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Joining Workshop...' : 'Join Workshop'}
            </button>
          </form>
        )}

        {isConnected && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 space-y-2">
            <p>You can also scan the QR code provided by your host</p>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-xs space-y-1">
              <p><strong>🔒 Security Note:</strong></p>
              <p className="text-left">Each workshop enforces unique identifiers:</p>
              <ul className="list-disc list-inside text-left space-y-0.5 ml-2">
                <li>One wallet address per workshop</li>
                <li>One email address per workshop (if provided)</li>
              </ul>
              <div className="mt-2 pt-2 border-t border-blue-300 dark:border-blue-700">
                <p className="text-left">
                  <strong>Why?</strong> This prevents identity confusion and ensures each participant has a unique, trackable presence in the workshop.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
