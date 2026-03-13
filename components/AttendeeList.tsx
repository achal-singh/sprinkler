'use client';

import { truncateAddress, formatTimestamp } from '@/lib/utils';
import type { Attendee, Milestone } from '@/lib/types';

interface AttendeeListProps {
  attendees: Attendee[];
  milestones: Milestone[];
  completions: Map<string, Set<string>>; // milestoneId -> attendeeIds
}

export default function AttendeeList({
  attendees,
  milestones,
  completions,
}: AttendeeListProps) {
  // Calculate progress for each attendee
  const getProgress = (attendeeId: string): number => {
    if (milestones.length === 0) return 0;
    
    let completedCount = 0;
    milestones.forEach((milestone) => {
      const attendeeIds = completions.get(milestone.id);
      if (attendeeIds?.has(attendeeId)) {
        completedCount++;
      }
    });
    
    return Math.round((completedCount / milestones.length) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
          Attendees ({attendees.length})
        </h3>
      </div>

      {attendees.length === 0 ? (
        <div className="text-center neo-muted py-8">
          <p>No attendees yet</p>
          <p className="text-sm mt-1">Share the session code to invite participants</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attendees.map((attendee) => {
            const progress = getProgress(attendee.id);

            return (
              <div
                key={attendee.id}
                className="p-3 neo-surface hover:translate-y-[-1px] transition-transform"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate text-gray-900 dark:text-white">
                        {attendee.display_name || truncateAddress(attendee.wallet_address)}
                      </p>
                    </div>
                    <p className="text-xs neo-muted font-mono">
                      {truncateAddress(attendee.wallet_address)}
                    </p>
                    {attendee.email && (
                      <p className="text-xs neo-muted mt-0.5">
                        {attendee.email}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {milestones.length > 0 && (
                      <>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {progress}%
                        </div>
                        <div className="w-16 h-2 bg-[color:var(--surface-3)] rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-[color:var(--accent)] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
