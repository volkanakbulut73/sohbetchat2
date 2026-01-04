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
  }, [currentRoomId, currentUser, topic, isPrivate, participants]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      // Önce kullanıcının mesajını gönder
      await sendMessageToPb(userMsgPayload, currentRoomId);
      
      // Botların cevap vermesi için kısa bir bekleme
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
            // Botun "yazıyor" efekti için mesaj uzunluğuna göre bekleme
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
      console.error("Mesajlaşma döngüsü hatası:", err);
      setIsTyping(false);
    }
  };

  const UserList = () => (
    <div className="bg-white h-full overflow-y-auto border-l border-gray-100 flex flex-col w-64 shrink-0">
        <div className="p-4 bg-white sticky top-0 z-10">
            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center">
                ÜYELER ({displayUsers.length})
            </h3>
        </div>
        <ul className="flex-1 p-2 space-y-1">
            {displayUsers.map(user => (
                <li 
                    key={user.id}
                    onDoubleClick={() => onUserDoubleClick && onUserDoubleClick(user)}
                    className={`
                        group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
                        ${user.id === currentUser.id ? 'bg-[#f0f4ff] border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}
                    `}
                >
                    <div className="relative shrink-0">
                        <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100 object-cover shadow-sm" />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBot ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                        <div className={`text-sm font-bold truncate ${user.id === currentUser.id ? 'text-[#2563eb]' : 'text-slate-700'}`}>
                            {user.name} {user.id === currentUser.id && '(Sen)'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">
                            {user.isBot ? user.role : 'Çevrimiçi'}
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
         <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6 bg-[#f8f9fa] relative">
            {messages.map((msg, index) => {
                if (msg.senderId === 'system') return (
                    <div key={msg.id} className="flex justify-center my-4">
                        <span className="text-[10px] text-gray-400 bg-white/50 px-3 py-1 rounded-full">{msg.text}</span>
                    </div>
                );
                
                const isMe = msg.senderId === currentUser.id;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end group mb-2`}>
                        <div className="shrink-0 mb-1">
                            <img src={msg.senderAvatar} className="w-9 h-9 rounded-full shadow-sm bg-gray-200 object-cover border-2 border-white" />
                        </div>

                        <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && (
                                 <span className="text-[11px] font-bold text-gray-400 mb-1 px-2">
                                     {msg.senderName}
                                 </span>
                             )}
                             
                             <div className={`
                                 relative px-4 py-2.5 text-[14px] leading-snug shadow-sm
                                 ${isMe 
                                     ? 'bg-[#2563eb] text-white rounded-[22px] rounded-br-[4px]' 
                                     : 'bg-white text-slate-700 rounded-[22px] rounded-bl-[4px] border border-gray-100'}
                             `}>
                                {msg.image && <img src={msg.image} className="max-w-full h-40 object-cover rounded-xl mb-2" />}
                                <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                             </div>
                             
                             <div className="text-[9px] text-gray-300 mt-1 px-2">
                                {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                )
            })}
            
            {isTyping && (
                <div className="flex items-center gap-2 ml-12">
                    <div className="flex space-x-1 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-50">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
         </div>

         <div className="bg-white p-4 border-t border-gray-100 shrink-0">
             <div className="max-w-5xl mx-auto flex items-center gap-3">
                 <div className="flex-1 bg-[#f0f2f5] rounded-full px-6 py-2 flex items-center gap-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                     <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-gray-400 hover:text-blue-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     </button>
                     <form onSubmit={handleSendMessage} className="flex-1">
                         <input 
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-700 outline-none py-2"
                            placeholder="Bir şeyler yaz..."
                         />
                     </form>
                 </div>

                 <button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isBlocked}
                    className="w-12 h-12 rounded-full bg-[#f0f2f5] hover:bg-blue-600 text-gray-400 hover:text-white flex items-center justify-center transition-all shadow-sm transform active:scale-95"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                     </svg>
                 </button>
             </div>
         </div>
      </div>

      <UserList />

    </div>
  );
};

export default AiChatModule;