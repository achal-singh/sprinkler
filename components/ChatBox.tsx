'use client';

import { useState, useRef, useEffect } from 'react';
import { formatTimestamp, truncateAddress } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';

interface ChatBoxProps {
  workshopId: string;
  currentUserWallet: string;
  currentUserName?: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
}

export default function ChatBox({
  workshopId,
  currentUserWallet,
  currentUserName,
  messages,
  onSendMessage,
}: ChatBoxProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = (msg: ChatMessage) => {
    const isOwnMessage = msg.sender_wallet.toLowerCase() === currentUserWallet.toLowerCase();
    const isSystem = msg.message_type === 'system';

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center my-2">
          <div className="neo-pill text-xs">
            {msg.message}
          </div>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs neo-muted">
              {msg.sender_name || truncateAddress(msg.sender_wallet)}
            </span>
            <span className="text-xs neo-muted">
              {formatTimestamp(msg.created_at)}
            </span>
          </div>
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage
                ? 'bg-[color:var(--accent)] text-white shadow-[var(--shadow-1)]'
                : 'neo-surface text-gray-900 dark:text-gray-100'
            }`}
          >
            {msg.message}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center neo-muted mt-8">
            <p>No messages yet</p>
            <p className="text-sm mt-1">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-[color:var(--surface-border)] p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="neo-input flex-1"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="neo-button px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[90px]"
          >
            {isSending ? <Spinner size="sm" /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
