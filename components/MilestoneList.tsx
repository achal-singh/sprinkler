'use client';

import { useState } from 'react';
import type { Milestone, Attendee } from '@/lib/types';
import { LoadingButton } from '@/components/ui/loading-button';
import { Spinner } from '@/components/ui/spinner';

interface MilestoneListProps {
  milestones: Milestone[];
  completions: Map<string, Set<string>>; // milestoneId -> attendeeIds
  currentAttendeeId?: string;
  isHost: boolean;
  onCreateMilestone?: (title: string, description: string) => Promise<void>;
  onCompleteMilestone?: (milestoneId: string) => Promise<void>;
}

export default function MilestoneList({
  milestones,
  completions,
  currentAttendeeId,
  isHost,
  onCreateMilestone,
  onCompleteMilestone,
}: MilestoneListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.title.trim() || !onCreateMilestone) return;

    setIsSubmitting(true);
    try {
      await onCreateMilestone(newMilestone.title, newMilestone.description);
      setNewMilestone({ title: '', description: '' });
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create milestone:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (milestoneId: string) => {
    if (!onCompleteMilestone) return;
    
    setCompletingId(milestoneId);
    try {
      await onCompleteMilestone(milestoneId);
    } catch (error) {
      console.error('Failed to complete milestone:', error);
    } finally {
      setCompletingId(null);
    }
  };

  const isCompleted = (milestoneId: string): boolean => {
    if (!currentAttendeeId) return false;
    const attendeeIds = completions.get(milestoneId);
    return attendeeIds ? attendeeIds.has(currentAttendeeId) : false;
  };

  const getCompletionCount = (milestoneId: string): number => {
    return completions.get(milestoneId)?.size || 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Milestones</h3>
        {isHost && onCreateMilestone && (
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="neo-button px-4 py-1.5 text-xs"
          >
            {isCreating ? 'Cancel' : '+ Add Milestone'}
          </button>
        )}
      </div>

      {/* Create milestone form (host only) */}
      {isCreating && isHost && (
        <form onSubmit={handleCreateMilestone} className="neo-panel p-4 space-y-3">
          <input
            type="text"
            placeholder="Milestone title"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            className="neo-input"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newMilestone.description}
            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
            className="neo-input min-h-[90px] resize-none"
            rows={2}
          />
          <LoadingButton
            type="submit"
            isLoading={isSubmitting}
            loadingText="Creating..."
            className="w-full py-2"
          >
            Create Milestone
          </LoadingButton>
        </form>
      )}

      {/* Milestones list */}
      {milestones.length === 0 ? (
        <div className="text-center neo-muted py-8">
          <p>No milestones yet</p>
          {isHost && (
            <p className="text-sm mt-1">Add your first milestone to track progress</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => {
            const completed = isCompleted(milestone.id);
            const completionCount = getCompletionCount(milestone.id);
            const isCompletingThis = completingId === milestone.id;

            return (
              <div
                key={milestone.id}
                className={`p-4 rounded-2xl transition-colors border ${
                  completed
                    ? 'bg-green-50/70 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'neo-surface border-[color:var(--surface-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono neo-muted">
                        #{index + 1}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-white">{milestone.title}</h4>
                      {completed && (
                        <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                      )}
                    </div>
                    {milestone.description && (
                      <p className="text-sm neo-muted mt-1">
                        {milestone.description}
                      </p>
                    )}
                    <p className="text-xs neo-muted mt-2">
                      {completionCount} {completionCount === 1 ? 'completion' : 'completions'}
                    </p>
                  </div>

                  {!isHost && !completed && onCompleteMilestone && (
                    <button
                      onClick={() => handleComplete(milestone.id)}
                      disabled={isCompletingThis}
                      className="neo-button px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap inline-flex items-center gap-2"
                    >
                      {isCompletingThis && <Spinner size="sm" />}
                      {isCompletingThis ? 'Completing...' : 'Mark Complete'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
