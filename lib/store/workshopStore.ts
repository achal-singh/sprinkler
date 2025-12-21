'use client';

import { create } from 'zustand';
import type { Attendee, Milestone, ChatMessage, MilestoneCompletion } from '@/lib/types';

interface WorkshopStore {
  // Attendees
  attendees: Map<string, Attendee[]>; // workshopId -> attendees
  addAttendee: (workshopId: string, attendee: Attendee) => void;
  getAttendees: (workshopId: string) => Attendee[];
  
  // Milestones
  milestones: Map<string, Milestone[]>; // workshopId -> milestones
  addMilestone: (workshopId: string, milestone: Milestone) => void;
  getMilestones: (workshopId: string) => Milestone[];
  
  // Milestone Completions
  completions: Map<string, Set<string>>; // milestoneId -> attendeeIds
  completeMilestone: (milestoneId: string, attendeeId: string) => void;
  getCompletions: (milestoneId: string) => Set<string>;
  
  // Chat Messages
  messages: Map<string, ChatMessage[]>; // workshopId -> messages
  addMessage: (workshopId: string, message: ChatMessage) => void;
  getMessages: (workshopId: string) => ChatMessage[];
}

export const useWorkshopStore = create<WorkshopStore>((set, get) => ({
  attendees: new Map(),
  milestones: new Map(),
  completions: new Map(),
  messages: new Map(),

  // Attendee methods
  addAttendee: (workshopId, attendee) => {
    set((state) => {
      const newAttendees = new Map(state.attendees);
      const current = newAttendees.get(workshopId) || [];
      newAttendees.set(workshopId, [...current, attendee]);
      return { attendees: newAttendees };
    });
  },

  getAttendees: (workshopId) => {
    return get().attendees.get(workshopId) || [];
  },

  // Milestone methods
  addMilestone: (workshopId, milestone) => {
    set((state) => {
      const newMilestones = new Map(state.milestones);
      const current = newMilestones.get(workshopId) || [];
      newMilestones.set(workshopId, [...current, milestone]);
      return { milestones: newMilestones };
    });
  },

  getMilestones: (workshopId) => {
    return get().milestones.get(workshopId) || [];
  },

  // Completion methods
  completeMilestone: (milestoneId, attendeeId) => {
    set((state) => {
      const newCompletions = new Map(state.completions);
      const current = newCompletions.get(milestoneId) || new Set();
      const updated = new Set(current);
      updated.add(attendeeId);
      newCompletions.set(milestoneId, updated);
      return { completions: newCompletions };
    });
  },

  getCompletions: (milestoneId) => {
    return get().completions.get(milestoneId) || new Set();
  },

  // Message methods
  addMessage: (workshopId, message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const current = newMessages.get(workshopId) || [];
      newMessages.set(workshopId, [...current, message]);
      return { messages: newMessages };
    });
  },

  getMessages: (workshopId) => {
    return get().messages.get(workshopId) || [];
  },
}));
