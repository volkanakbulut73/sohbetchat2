

export enum Role {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant'
}

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

export interface Message extends BaseRecord {
  role: Role;
  content: string;
  room_id: string;
  user_id: string; // Relation to users
  color?: string;
  expand?: {
    user_id?: User;
  };
  // UI helper props
  timestamp?: number; 
}

export interface User extends BaseRecord {
  username: string;
  email: string;
  name: string;
  avatar?: string;
  status?: string;
  isOnline?: boolean;
  isBot?: boolean;
  color?: string;
}

export interface Room extends BaseRecord {
  name: string;
  topic: string;
  active: boolean; // UI state mostly
  type: 'public' | 'private';
  participants: string[]; // Array of User IDs
  otherUserId?: string; // Helper for private rooms
}

export interface RoomState extends BaseRecord {
  room_id: string;
  is_muted: boolean;
  ai_typing: boolean;
  ai_user_id: string;
}

export interface BannedUser extends BaseRecord {
  user_id: string; // The person who is blocking
  target_user_id: string; // The person being blocked
  room_id?: string; // Optional: block only in specific room?
}
