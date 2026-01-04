import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types.ts';
import { generateGroupResponse } from '../services/geminiService.ts';
import { pb, sendMessageToPb, getRoomMessages } from '../services/pocketbase.ts';

interface AiChatModuleProps {
  currentUser: User;           
  topic: string;               
  participants: User[];        
  title?: string;
  roomId?: string; 
  height?: string;             
  onClose?: () => void;        
  
  isPrivate?: boolean;         
  isBlocked?: boolean;         
  onBlockUser?: () => void;    
  onUnblockUser?: () => void;  
  onUserDoubleClick?: (user: User) => void; 
}

const EMOJIS = [
  "😀", "😂", "😉", "😍", "😎", "😭", "😡", "🤔", "👍", "👎", 
  "🙏", "💪", "❤️", "💔", "🎉", "🔥", "👋", "💋", "🌹", "⭐",
  "😱", "😴", "🤮", "🤐", "🤯", "👻", "💩", "👀", "🙌", "👏"
];

const AiChatModule: React.FC<AiChatModuleProps> = ({ 
  currentUser, 
  topic, 
  participants, 
  title, 
  roomId,
  isPrivate = false,
  isBlocked = false,
  onBlockUser,
  onUnblockUser,
  onUserDoubleClick
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentRoomId = roomId || (isPrivate ? `private_${currentUser.id}` : 'general');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_73b3780373.mp3'); 
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
  };

  useEffect(() => {
    const loadHistory = async () => {
        const history = await getRoomMessages(currentRoomId);
        if (history.length > 0) {
            setMessages(history);
        } else {
             const greetingText = isPrivate 
               ? `${participants[0]?.name} ile özel sohbet başladı.`
               : `${currentUser.name} sohbete katıldı.\nKonu: ${topic}`;

             const greeting: Message = {
               id: 'system-welcome',
               senderId: 'system',
               senderName: 'Sistem',
               senderAvatar: '',
               text: greetingText,
               timestamp: new Date(),
               isUser: false,
             };
             setMessages([greeting]);
        }
    };
    loadHistory();

    pb.collection('messages').subscribe('*', function (e) {
        if (e.action === 'create' && e.record.room === currentRoomId) {
            setMessages(prev => {
                if (prev.some(m => m.id === e.record.id)) return prev;
                if (e.record.senderId !== currentUser.id) playNotificationSound();

                const newMsg: Message = {
                    id: e.record.id,
                    senderId: e.record.senderId,
                    senderName: e.record.senderName,
                    senderAvatar: e.record.senderAvatar,
                    text: e.record.text,
                    timestamp: new Date(e.record.created),
                    isUser: e.record.isUser,
                    image: e.record.image || undefined
                };
                return [...prev, newMsg];
            });
        }
    });

    return () => {
        pb.collection('messages').unsubscribe('*');
    };
  }, [currentRoomId, currentUser, topic, isPrivate, participants]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, selectedImage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const insertAtCursor = (textToInsert: string) => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    
    const newText = inputText.substring(0, start) + textToInsert + inputText.substring(end);
    setInputText(newText);
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + textToInsert.length;
      input.focus();
    }, 0);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isBlocked) return;

    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: inputText,
      image: selectedImage || undefined,
      timestamp: new Date(),
      isUser: true,
    };

    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    try {
      await sendMessageToPb(userMsgPayload, currentRoomId);
      
      setIsTyping(true);
      // Construct temp context for bot
      const tempHistoryForAI: Message[] = [...messages, { ...userMsgPayload, id: 'temp' }];

      const botResponses = await generateGroupResponse(
        tempHistoryForAI,
        participants,
        topic,
        currentUser.name
      );

      setIsTyping(false);

      if (botResponses.length > 0) {
        for (const resp of botResponses) {
          const bot = participants.find((p) => p.id === resp.botId);
          if (bot) {
            setIsTyping(true);
            await new Promise(resolve => setTimeout(resolve, Math.min(2500, Math.max(800, resp.message.length * 20))));
            setIsTyping(false);

            const botMsgPayload: Omit<Message, 'id'> = {
                senderId: bot.id,
                senderName: bot.name,
                senderAvatar: bot.avatar,
                text: resp.message,
                timestamp: new Date(),
                isUser: false
            };
            await sendMessageToPb(botMsgPayload, currentRoomId);
          }
        }
      }
    } catch (err) {
      console.error("Mesajlaşma hatası:", err);
      setIsTyping(false);
    }
  };

  const allUsersInRoom = [currentUser, ...participants];

  // User List Component (Fixed Right Sidebar)
  const UserList = () => (
    <div className="bg-[#1f1f1f] h-full overflow-y-auto border-l border-gray-800 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="p-2 border-b border-gray-800 bg-[#151515] sticky top-0 z-10">
            <h3 className="text-[#00ff9d] text-[10px] md:text-xs font-mono font-bold uppercase text-center tracking-widest truncate">
                Kişiler ({allUsersInRoom.length})
            </h3>
        </div>
        <ul className="p-1 md:p-2 space-y-1">
            {allUsersInRoom.map(user => (
                <li 
                    key={user.id}
                    onDoubleClick={() => onUserDoubleClick && onUserDoubleClick(user)}
                    className={`
                        group flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2 p-1.5 rounded cursor-pointer transition-colors
                        ${user.id === currentUser.id ? 'bg-[#00ff9d]/10' : 'hover:bg-white/5'}
                    `}
                >
                    <div className="relative shrink-0">
                        <img src={user.avatar} className="w-6 h-6 md:w-8 md:h-8 rounded bg-gray-800 object-cover" />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full border-2 border-[#1f1f1f] ${user.isBot ? 'bg-blue-500' : 'bg-[#00ff9d]'}`}></div>
                    </div>
                    <div className="min-w-0 overflow-hidden text-center md:text-left w-full">
                        <div className={`text-[10px] md:text-sm truncate font-mono ${user.isBot ? 'text-blue-400' : 'text-gray-300'}`}>
                            {user.isBot && '@'}{user.name}
                        </div>
                        {user.isBot && <div className="hidden md:block text-[10px] text-gray-500 truncate">{user.role}</div>}
                    </div>
                </li>
            ))}
        </ul>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-[#252525] overflow-hidden">
      
      {/* Center: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
         
         {/* Info Bar (Inside Chat) */}
         <div className="bg-[#151515] border-b border-gray-800 px-4 py-2 flex items-center justify-between text-xs text-gray-400 shrink-0">
            <span className="truncate">{title} :: {topic}</span>
         </div>

         {/* Messages */}
         <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 relative bg-[#252525]">
            {messages.map((msg) => {
                if (msg.senderId === 'system') return (
                    <div key={msg.id} className="text-center py-2"><span className="text-xs text-gray-500 bg-black/20 px-2 py-1 rounded">{msg.text}</span></div>
                );
                
                const isMe = msg.isUser;
                return (
                    <div key={msg.id} className={`flex gap-2 md:gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                        <div className="shrink-0 mt-0.5">
                            <img src={msg.senderAvatar} className="w-6 h-6 md:w-8 md:h-8 rounded object-cover bg-gray-800" />
                        </div>
                        <div className={`max-w-[85%] md:max-w-[70%]`}>
                             <div className={`flex items-baseline gap-2 mb-0.5 ${isMe ? 'justify-end' : ''}`}>
                                 <span className={`text-[10px] md:text-xs font-bold cursor-pointer hover:underline ${isMe ? 'text-[#00ff9d]' : 'text-blue-400'}`}>{msg.senderName}</span>
                                 <span className="text-[9px] md:text-[10px] text-gray-600">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </div>
                             <div className={`p-2 md:p-2.5 rounded text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                                 isMe 
                                 ? 'bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/20' 
                                 : 'bg-[#151515] text-gray-300 border border-gray-800'
                             }`}>
                                {msg.image && <img src={msg.image} className="max-w-full h-32 md:h-40 object-contain rounded mb-2 border border-black/50" />}
                                {msg.text}
                             </div>
                        </div>
                    </div>
                )
            })}
            
            {isTyping && (
                <div className="flex items-center gap-2 text-gray-500 text-xs italic ml-12">
                    <span>yazıyor...</span>
                </div>
            )}
            <div ref={messagesEndRef} />
         </div>

         {/* Input Area */}
         <div className="bg-[#1a1a1a] border-t border-gray-800 p-2 md:p-3 flex gap-2 shrink-0">
             {isPrivate && (
                 <>
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" />
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white bg-[#252525] rounded border border-gray-700">📷</button>
                 </>
             )}
             <button 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className="p-2 text-gray-400 hover:text-white bg-[#252525] rounded border border-gray-700 relative"
             >
                😊
                {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 bg-[#1a1a1a] border border-gray-700 p-2 grid grid-cols-6 gap-1 w-64 rounded shadow-xl max-h-48 overflow-y-auto z-50">
                        {EMOJIS.map(e => <button key={e} onClick={() => {insertAtCursor(e); setShowEmojiPicker(false)}} className="hover:bg-white/10 p-1 rounded">{e}</button>)}
                    </div>
                )}
             </button>
             
             {selectedImage && (
                 <div className="relative">
                     <img src={selectedImage} className="h-10 w-10 object-cover rounded border border-[#00ff9d]" />
                     <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                 </div>
             )}

             <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                 <input 
                    ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    className="flex-1 bg-[#050505] text-gray-200 border border-gray-700 rounded px-3 md:px-4 text-sm focus:outline-none focus:border-[#00ff9d] placeholder-gray-600"
                    placeholder="Mesaj..."
                 />
                 <button type="submit" className="px-3 md:px-6 bg-[#00ff9d] text-black font-bold text-xs md:text-sm rounded hover:bg-[#00cc7d] transition-colors">GÖNDER</button>
             </form>
         </div>

      </div>

      {/* Fixed Right Sidebar: User List (Always Visible) */}
      <div className="w-20 md:w-56 shrink-0 border-l border-gray-800 flex flex-col bg-[#1f1f1f]">
          <UserList />
      </div>

    </div>
  );
};

export default AiChatModule;