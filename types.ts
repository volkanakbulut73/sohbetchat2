export interface User {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  role?: string; // e.g., "Philosopher", "Comedian"
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
}

export interface ChatRoom {
  id: string;
  name: string;
  topic: string;
  participants: User[];
  description: string;
  isPrivate?: boolean; // Yeni eklenen alan
}

// Response from Gemini structure
export interface BotResponseItem {
  botId: string;
  message: string;
}