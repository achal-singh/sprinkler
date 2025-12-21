'use client';

import { useState } from 'react';
import type { Milestone, Attendee } from '@/lib/types';

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
    
    try {
      await onCompleteMilestone(milestoneId);
    } catch (error) {
      console.error('Failed to complete milestone:', error);
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
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {isCreating ? 'Cancel' : '+ Add Milestone'}
          </button>
        )}
      </div>

      {/* Create milestone form (host only) */}
      {isCreating && isHost && (
        <form onSubmit={handleCreateMilestone} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3 bg-gray-50 dark:bg-gray-700">
          <input
            type="text"
            placeholder="Milestone title"
            value={newMilestone.title}
            onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newMilestone.description}
            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            rows={2}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Milestone'}
          </button>
        </form>
      )}

      {/* Milestones list */}
      {milestones.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
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

            return (
              <div
                key={milestone.id}
                className={`p-4 border rounded-lg transition-colors ${
                  completed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </span>
                      <h4 className="font-medium text-gray-900 dark:text-white">{milestone.title}</h4>
                      {completed && (
                        <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                      )}
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {milestone.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {completionCount} {completionCount === 1 ? 'completion' : 'completions'}
                    </p>
                  </div>

                  {!isHost && !completed && onCompleteMilestone && (
                    <button
                      onClick={() => handleComplete(milestone.id)}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                      Mark Complete
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
