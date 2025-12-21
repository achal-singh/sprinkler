// Database Types for Workshop Features

export interface Workshop {
  id: string;
  title: string;
  description: string | null;
  host_wallet: string;
  session_code: string; // Short code for easy joining (e.g., "ABC123")
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Attendee {
  id: string;
  workshop_id: string;
  wallet_address: string;
  email: string | null;
  display_name: string | null;
  joined_at: string;
  last_seen: string;
}

export interface Milestone {
  id: string;
  workshop_id: string;
  title: string;
  description: string | null;
  order_index: number; // For sorting milestones
  created_at: string;
  created_by: string; // host wallet
}

export interface MilestoneCompletion {
  id: string;
  milestone_id: string;
  attendee_id: string;
  completed_at: string;
  notes: string | null;
}

export interface ChatMessage {
  id: string;
  workshop_id: string;
  sender_wallet: string;
  sender_name: string | null;
  message: string;
  message_type: 'text' | 'system' | 'milestone_created' | 'milestone_completed';
  created_at: string;
}

// API Response types
export interface CreateWorkshopRequest {
  title: string;
  description?: string;
  hostWallet: string;
}

export interface CreateWorkshopResponse {
  workshop: Workshop;
  qrCodeUrl: string;
  joinUrl: string;
}

export interface JoinWorkshopRequest {
  sessionCode: string;
  walletAddress: string;
  email?: string;
  displayName?: string;
}

export interface CreateMilestoneRequest {
  workshopId: string;
  title: string;
  description?: string;
  hostWallet: string;
}

export interface CompleteMilestoneRequest {
  milestoneId: string;
  attendeeId: string;
  notes?: string;
}

export interface SendMessageRequest {
  workshopId: string;
  senderWallet: string;
  senderName?: string;
  message: string;
}

// Frontend State types
export interface WorkshopState {
  currentWorkshop: Workshop | null;
  attendees: Attendee[];
  milestones: Milestone[];
  completions: Map<string, Set<string>>; // milestoneId -> Set of attendeeIds
  messages: ChatMessage[];
}
