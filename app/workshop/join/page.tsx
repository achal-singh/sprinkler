'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JoinWorkshopPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    sessionCode: '',
    walletAddress: '',
    email: '',
    displayName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!formData.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Please enter a valid Ethereum wallet address');
      setIsLoading(false);
      return;
    }

    if (!formData.sessionCode.match(/^[A-Z0-9]{6}$/)) {
      setError('Session code should be 6 characters (e.g., ABC123)');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/workshop/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join workshop');
      }

      const data = await response.json();
      
      // Redirect to the workshop page
      router.push(`/workshop/${formData.sessionCode}?attendee=${data.attendee.id}`);
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
            <label htmlFor="walletAddress" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
              Your Wallet Address *
            </label>
            <input
              id="walletAddress"
              type="text"
              required
              value={formData.walletAddress}
              onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="0x..."
            />
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
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
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

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>You can also scan the QR code provided by your host</p>
        </div>
      </div>
    </div>
  );
}
