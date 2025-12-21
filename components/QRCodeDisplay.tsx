'use client';

import { useState } from 'react';

interface QRCodeDisplayProps {
  qrCodeUrl: string;
  sessionCode: string;
  joinUrl: string;
}

export default function QRCodeDisplay({ qrCodeUrl, sessionCode, joinUrl }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Share with Attendees</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Scan QR code or share the session code
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="p-4 bg-white rounded-lg border border-gray-300 dark:border-gray-600">
          <img src={qrCodeUrl} alt="Workshop QR Code" className="w-48 h-48" />
        </div>
      </div>

      {/* Session Code */}
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Session Code</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <span className="text-3xl font-bold tracking-wider font-mono text-gray-900 dark:text-white">
            {sessionCode}
          </span>
          <button
            onClick={() => copyToClipboard(sessionCode)}
            className="ml-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Join URL */}
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Join URL</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinUrl}
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={() => copyToClipboard(joinUrl)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
