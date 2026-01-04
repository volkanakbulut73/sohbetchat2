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
  isPrivate?: boolean;         
  isBlocked?: boolean;         
  onUserDoubleClick?: (user: User) => void; 
}

const AiChatModule: React.FC<AiChatModuleProps> = ({ 
  currentUser, 
  topic, 
  participants, 
  title, 
  roomId,
  isPrivate = false,
  isBlocked = false,
  onUserDoubleClick
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [showUserList, setShowUserList] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
               : `${currentUser.name} sohbete katıldı.`;

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

    const unsubscribe = pb.collection('messages').subscribe('*', function (e) {
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
  }, [currentRoomId, currentUser, isPrivate, participants]);

  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    uniqueUsers.set(currentUser.id, currentUser);
    participants.forEach(p => uniqueUsers.set(p.id, p));
    messages.forEach(msg => {
        if (!uniqueUsers.has(msg.senderId) && msg.senderId !== 'system') {
            uniqueUsers.set(msg.senderId, {
                id: msg.senderId,
                name: msg.senderName,
                avatar: msg.senderAvatar,
                isBot: false
            });
        }
    });
    setDisplayUsers(Array.from(uniqueUsers.values()));
  }, [messages, currentUser, participants]);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

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
    
    try {
      await sendMessageToPb(userMsgPayload, currentRoomId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsTyping(true);
      const botResponses = await generateGroupResponse(
        [...messages, { ...userMsgPayload, id: 'temp' }], 
        participants, 
        topic, 
        currentUser.name
      );
      setIsTyping(false);

      if (botResponses && botResponses.length > 0) {
        for (const resp of botResponses) {
          const bot = participants.find((p) => p.id === resp.botId);
          if (bot) {
            setIsTyping(true);
            const typingSpeed = Math.min(2000, Math.max(1000, resp.message.length * 30));
            await new Promise(resolve => setTimeout(resolve, typingSpeed));
            setIsTyping(false);
            
            await sendMessageToPb({
                senderId: bot.id,
                senderName: bot.name,
                senderAvatar: bot.avatar,
                text: resp.message,
                timestamp: new Date(),
                isUser: false
            }, currentRoomId);
          }
        }
      }
    } catch (err) {
      console.error("Mesaj hatası:", err);
      setIsTyping(false);
    }
  };

  const UserListSidebar = () => (
    <div className={`
        fixed md:relative inset-y-0 right-0 z-[60] w-72 bg-white border-l border-gray-100 flex flex-col transition-transform duration-300 transform shadow-2xl md:shadow-none
        ${showUserList ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
    `}>
        <div className="p-4 border-b border-gray-50 flex items-center justify-between shrink-0">
            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                ÜYELER ({displayUsers.length})
            </h3>
            <button onClick={() => setShowUserList(false)} className="md:hidden p-2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 touch-auto">
            {displayUsers.map(user => (
                <li 
                    key={user.id}
                    onClick={() => {
                        if (window.innerWidth < 768) setShowUserList(false);
                        onUserDoubleClick && onUserDoubleClick(user);
                    }}
                    className={`
                        list-none group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                        ${user.id === currentUser.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                    `}
                >
                    <div className="relative shrink-0">
                        <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100 object-cover shadow-sm" />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBot ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                        <div className={`text-sm font-bold truncate ${user.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>
                            {user.name} {user.id === currentUser.id && '(Sen)'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate uppercase">
                            {user.isBot ? user.role : 'Çevrimiçi'}
                        </div>
                    </div>
                </li>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      
      {/* Overlay for mobile sidebar */}
      {showUserList && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] md:hidden" 
            onClick={() => setShowUserList(false)}
          />
      )}

      <div className="flex-1 flex flex-col min-w-0 relative h-full">
         
         {/* Topic/Header Bar */}
         <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/95 backdrop-blur-md z-10 shrink-0">
             <div className="min-w-0">
                 <h2 className="text-sm font-bold text-slate-800 truncate">{title || topic}</h2>
                 <p className="text-[10px] text-gray-400 truncate hidden md:block">{topic}</p>
             </div>
             <button 
                onClick={() => setShowUserList(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-slate-500 hover:bg-gray-100 transition-colors"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <span className="hidden sm:inline">Üyeler</span>
             </button>
         </div>

         {/* Messages Area - Fixed scroll container */}
         <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#f8f9fa] touch-auto scroll-smooth">
            {messages.map((msg, index) => {
                if (msg.senderId === 'system') return (
                    <div key={msg.id} className="flex justify-center my-2">
                        <span className="text-[10px] text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-100 shadow-sm">{msg.text}</span>
                    </div>
                );
                
                const isMe = msg.senderId === currentUser.id;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
                        <div className="shrink-0 mb-4">
                            <img src={msg.senderAvatar} className="w-8 h-8 rounded-full shadow-sm bg-gray-200 object-cover border-2 border-white" />
                        </div>

                        <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && (
                                 <span className="text-[10px] font-bold text-gray-400 mb-1 px-1 uppercase tracking-tight">
                                     {msg.senderName}
                                 </span>
                             )}
                             
                             <div className={`
                                 relative px-3 py-2 text-[14px] leading-relaxed shadow-sm
                                 ${isMe 
                                     ? 'bg-blue-600 text-white rounded-[20px] rounded-br-[4px]' 
                                     : 'bg-white text-slate-700 rounded-[20px] rounded-bl-[4px] border border-gray-100'}
                             `}>
                                {msg.image && <img src={msg.image} className="max-w-full h-auto rounded-lg mb-2 border border-black/5 shadow-sm" />}
                                <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                             </div>
                             
                             <div className="text-[9px] text-gray-300 mt-1 px-1">
                                {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                )
            })}
            
            {isTyping && (
                <div className="flex items-center gap-2 ml-10">
                    <div className="flex space-x-1 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-50">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4 shrink-0" />
         </div>

         {/* Input Area */}
         <div className="bg-white p-3 md:p-4 border-t border-gray-100 shrink-0">
             <div className="max-w-4xl mx-auto flex items-center gap-2">
                 <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex items-center gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-200">
                     <form onSubmit={handleSendMessage} className="flex-1">
                         <input 
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-700 outline-none py-1"
                            placeholder="Mesaj yazın..."
                         />
                     </form>
                 </div>

                 <button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() && !selectedImage}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center transition-all shadow-md active:scale-90 disabled:opacity-50 disabled:bg-gray-400 shrink-0"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                     </svg>
                 </button>
             </div>
         </div>
      </div>

      <UserListSidebar />

    </div>
  );
};

export default AiChatModule;