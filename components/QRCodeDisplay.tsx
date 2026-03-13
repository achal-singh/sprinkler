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
        <p className="text-sm neo-muted">
          Scan QR code or share the session code
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="neo-surface p-4">
          <img src={qrCodeUrl} alt="Workshop QR Code" className="w-48 h-48" />
        </div>
      </div>

      {/* Session Code */}
      <div className="text-center">
        <p className="text-sm neo-muted mb-1">Session Code</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 neo-surface">
          <span className="text-3xl font-bold tracking-wider font-mono text-gray-900 dark:text-white">
            {sessionCode}
          </span>
          <button
            onClick={() => copyToClipboard(sessionCode)}
            className="ml-2 neo-button px-3 py-1 text-sm"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Join URL */}
      <div>
        <p className="text-sm neo-muted mb-1">Join URL</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinUrl}
            readOnly
            className="neo-input flex-1 text-sm font-mono"
          />
          <button
            onClick={() => copyToClipboard(joinUrl)}
            className="neo-button px-4 py-2 whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
