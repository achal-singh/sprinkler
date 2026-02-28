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
          <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs text-gray-600 dark:text-gray-400">
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
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {msg.sender_name || truncateAddress(msg.sender_wallet)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTimestamp(msg.created_at)}
            </span>
          </div>
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white dark:bg-gray-800">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p>No messages yet</p>
            <p className="text-sm mt-1">Be the first to say hello! 👋</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 min-w-[80px]"
          >
            {isSending ? <Spinner size="sm" /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
