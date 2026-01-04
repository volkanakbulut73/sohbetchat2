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
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);

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

  // Update Display Users based on participants + messages history
  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    
    // 1. Add Current User
    uniqueUsers.set(currentUser.id, currentUser);
    
    // 2. Add Defined Participants (Bots)
    participants.forEach(p => uniqueUsers.set(p.id, p));

    // 3. Scan messages for other users
    messages.forEach(msg => {
        if (!uniqueUsers.has(msg.senderId) && msg.senderId !== 'system') {
            uniqueUsers.set(msg.senderId, {
                id: msg.senderId,
                name: msg.senderName,
                avatar: msg.senderAvatar,
                isBot: false // Assumed human if not in participants list
            });
        }
    });

    setDisplayUsers(Array.from(uniqueUsers.values()));
  }, [messages, currentUser, participants]);

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

  // User List Component (Modern Right Sidebar - Always Visible)
  const UserList = () => (
    <div className="bg-white h-full overflow-y-auto border-l border-gray-100 flex flex-col w-56 shrink-0">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center">
                Üyeler ({displayUsers.length})
            </h3>
        </div>
        <ul className="flex-1 p-2 space-y-1">
            {displayUsers.map(user => (
                <li 
                    key={user.id}
                    onDoubleClick={() => onUserDoubleClick && onUserDoubleClick(user)}
                    className={`
                        group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all
                        ${user.id === currentUser.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'}
                    `}
                >
                    <div className="relative shrink-0">
                        <img src={user.avatar} className="w-9 h-9 rounded-full bg-gray-200 object-cover shadow-sm" />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBot ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                        <div className={`text-xs font-bold truncate ${user.isBot ? 'text-blue-600' : 'text-slate-700'} ${user.id === currentUser.id ? 'text-indigo-700' : ''}`}>
                            {user.name} {user.id === currentUser.id && '(Sen)'}
                        </div>
                        {user.isBot && <div className="text-[10px] text-gray-400 truncate">{user.role}</div>}
                    </div>
                </li>
            ))}
        </ul>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden">
      
      {/* Center: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
         
         {/* Info Bar (Inside Chat) */}
         <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
            <div>
                <h2 className="text-slate-800 font-bold text-sm flex items-center gap-2">
                   {isPrivate ? '🔒 Özel Sohbet' : `# ${title}`}
                </h2>
                <p className="text-xs text-gray-500 truncate max-w-md">{topic}</p>
            </div>
         </div>

         {/* Messages Area - Added flex-1 and min-h-0 to allow scrolling only here */}
         <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5 bg-[#F9FAFB] relative">
            {messages.map((msg, index) => {
                if (msg.senderId === 'system') return (
                    <div key={msg.id} className="flex justify-center my-4">
                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-sm">{msg.text}</span>
                    </div>
                );
                
                const isMe = msg.isUser && msg.senderId === currentUser.id;
                const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
                        {/* Avatar */}
                        <div className={`shrink-0 ${!showAvatar ? 'invisible' : ''}`}>
                            <img src={msg.senderAvatar} className="w-8 h-8 rounded-full shadow-sm bg-gray-200 object-cover border border-white" />
                        </div>

                        {/* Message Bubble Container */}
                        <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showAvatar && (
                                 <span className="text-[11px] text-gray-400 mb-1 px-1">
                                     {msg.senderName}
                                 </span>
                             )}
                             
                             <div className={`
                                 relative px-4 py-3 text-[14px] leading-relaxed shadow-sm transition-all
                                 ${isMe 
                                     ? 'bg-[#2563eb] text-white rounded-[20px] rounded-tr-sm' // Blue bubble for User
                                     : 'bg-white text-slate-800 rounded-[20px] rounded-tl-sm shadow-[0_2px_5px_rgba(0,0,0,0.05)] border border-gray-50'} // White bubble for Bots
                             `}>
                                {msg.image && (
                                    <img src={msg.image} className="max-w-full h-40 object-cover rounded-xl mb-2 bg-white" />
                                )}
                                <div className="whitespace-pre-wrap">{msg.text}</div>
                             </div>
                             
                             {/* Timestamp outside bubble */}
                             {showAvatar && (
                                <div className="text-[9px] text-gray-300 mt-1 px-1">
                                    {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </div>
                             )}
                        </div>
                    </div>
                )
            })}
            
            {isTyping && (
                <div className="flex items-center gap-3 ml-12 mt-2">
                     <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100">
                        <span className="text-xs">💬</span>
                     </div>
                    <div className="flex space-x-1.5 bg-white px-4 py-3 rounded-full shadow-sm border border-gray-50">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
         </div>

         {/* Input Area */}
         <div className="bg-white p-4 border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] z-30 shrink-0">
             <div className="max-w-4xl mx-auto flex items-end gap-2">
                 
                 {/* Tools Button Group */}
                 <div className="flex gap-1 pb-1">
                     {isPrivate && (
                         <>
                            <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                         </>
                     )}
                     <div className="relative">
                         <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                            className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-colors"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </button>
                         {showEmojiPicker && (
                            <div className="absolute bottom-12 left-0 bg-white border border-gray-200 p-3 grid grid-cols-6 gap-2 w-72 rounded-2xl shadow-xl max-h-64 overflow-y-auto z-50">
                                {EMOJIS.map(e => (
                                    <button 
                                        key={e} 
                                        onClick={() => {insertAtCursor(e); setShowEmojiPicker(false)}} 
                                        className="text-xl hover:bg-gray-100 p-2 rounded-lg transition-colors"
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        )}
                     </div>
                 </div>
                 
                 {/* Input Field */}
                 <div className="flex-1 bg-gray-100 rounded-[1.5rem] px-4 py-2 flex items-center gap-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-md transition-all">
                     {selectedImage && (
                         <div className="relative group">
                             <img src={selectedImage} className="h-10 w-10 object-cover rounded-lg border border-indigo-200" />
                             <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                         </div>
                     )}
                     <form onSubmit={handleSendMessage} className="flex-1 flex">
                         <input 
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            className="flex-1 bg-transparent text-slate-700 text-sm focus:outline-none placeholder-gray-400 py-2"
                            placeholder="Bir şeyler yaz..."
                         />
                     </form>
                 </div>

                 {/* Send Button */}
                 <button 
                    onClick={() => handleSendMessage()}
                    disabled={(!inputText.trim() && !selectedImage) || isBlocked}
                    className={`p-3 rounded-full shadow-lg transition-all transform active:scale-90 flex items-center justify-center
                        ${(!inputText.trim() && !selectedImage) || isBlocked 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-300'}
                    `}
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                     </svg>
                 </button>
             </div>
         </div>
      </div>

      {/* User Sidebar - Always Visible now */}
      <UserList />

    </div>
  );
};

export default AiChatModule;