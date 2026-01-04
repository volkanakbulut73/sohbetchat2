
export interface User {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  role?: string; 
  isAdmin?: boolean; // Süper Yönetici
  isOp?: boolean;    // Operatör (Kısıtlı yetki)
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
  image?: string; // Base64 image string
  audio?: string; // Base64 audio string
}

export interface ChatRoom {
  id: string;
  name: string;
  topic: string;
  participants: User[];
  description: string;
  isPrivate?: boolean;
}

// Banned User Structure
export interface BannedUser {
  id: string;
  email: string; // Banlanan email veya ID
  reason?: string;
  created: string;
}

export interface BotResponseItem {
  botId: string;
  message: string;
}
