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

const EMOJIS = ['😊', '😂', '👍', '🔥', '❤️', '👏', '😮', '😢', '🙌', '✨', '🤔', '😎', '🚀', '✅', '❌'];

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const insertFormat = (tag: string, endTag?: string) => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart || 0;
    const end = inputRef.current.selectionEnd || 0;
    const text = inputText;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const actualEndTag = endTag || tag;
    const newText = `${before}${tag}${selectedText}${actualEndTag}${after}`;
    
    setInputText(newText);
    setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(start + tag.length, end + tag.length);
    }, 10);
  };

  const insertEmoji = (emoji: string) => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart || 0;
    const text = inputText;
    const before = text.substring(0, start);
    const after = text.substring(start);
    setInputText(before + emoji + after);
    setShowEmojiPicker(false);
    setTimeout(() => {
        inputRef.current?.focus();
        const newPos = start + emoji.length;
        inputRef.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isBlocked) return;

    const currentInput = inputText;
    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: currentInput,
      image: selectedImage || undefined,
      timestamp: new Date(),
      isUser: true,
    };

    setInputText('');
    setSelectedImage(null);
    setShowEmojiPicker(false);
    
    if (inputRef.current) {
        inputRef.current.focus();
    }
    
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
    <div className="relative z-20 w-24 sm:w-72 bg-white border-l border-gray-100 flex flex-col shrink-0">
        <div className="p-3 sm:p-4 border-b border-gray-50 shrink-0">
            <h3 className="text-gray-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center sm:text-left">
                ÜYELER <span className="hidden sm:inline">({displayUsers.length})</span>
            </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-1 sm:p-2 space-y-1 touch-auto scroll-smooth">
            {displayUsers.map(user => (
                <div 
                    key={user.id}
                    onClick={() => onUserDoubleClick && onUserDoubleClick(user)}
                    className={`
                        group flex items-center gap-1 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all
                        ${user.id === currentUser.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                    `}
                >
                    <div className="relative shrink-0 hidden sm:block">
                        <img src={user.avatar} className="w-10 h-10 rounded-full bg-gray-100 object-cover shadow-sm" />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${user.isBot ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    </div>
                    <div className={`sm:hidden w-1.5 h-1.5 shrink-0 rounded-full ${user.isBot ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    <div className="min-w-0 overflow-hidden text-center sm:text-left">
                        <div className={`text-[10px] sm:text-sm font-bold truncate ${user.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>
                            {user.name}
                        </div>
                        <div className="text-[8px] sm:text-[11px] text-gray-400 truncate uppercase">
                            {user.isBot ? (user.role?.split(' ')[0] || 'Bot') : 'Aktif'}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 relative h-full border-r border-gray-50">
         <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/95 backdrop-blur-md z-10 shrink-0">
             <div className="min-w-0">
                 <h2 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{title || topic}</h2>
                 <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">{topic}</p>
             </div>
         </div>

         <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-[#f8f9fa] touch-auto scroll-smooth">
            {messages.map((msg, index) => {
                if (msg.senderId === 'system') return (
                    <div key={msg.id} className="flex justify-center my-2">
                        <span className="text-[9px] sm:text-[10px] text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-100 shadow-sm">{msg.text}</span>
                    </div>
                );
                
                const isMe = msg.senderId === currentUser.id;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
                        <div className="shrink-0 mb-4">
                            <img src={msg.senderAvatar} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-sm bg-gray-200 object-cover border-2 border-white" />
                        </div>
                        <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && (
                                 <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 mb-1 px-1 uppercase tracking-tight">
                                     {msg.senderName}
                                 </span>
                             )}
                             <div className={`
                                 relative px-3 py-2 text-[13px] sm:text-[14px] leading-relaxed shadow-sm
                                 ${isMe 
                                     ? 'bg-blue-600 text-white rounded-[18px] rounded-br-[4px]' 
                                     : 'bg-white text-slate-700 rounded-[18px] rounded-bl-[4px] border border-gray-100'}
                             `}>
                                {msg.image && <img src={msg.image} className="max-w-full h-auto rounded-lg mb-2 border border-black/5 shadow-sm" />}
                                <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                             </div>
                             <div className="text-[8px] sm:text-[9px] text-gray-300 mt-1 px-1">
                                {msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                )
            })}
            
            {isTyping && (
                <div className="flex items-center gap-2 ml-10">
                    <div className="flex space-x-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4 shrink-0" />
         </div>

         <div className="bg-white border-t border-gray-100 shrink-0 relative">
             {/* Toolbar */}
             <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-50">
                <button 
                  onMouseDown={(e) => { e.preventDefault(); insertFormat('**'); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-slate-600 font-bold text-xs"
                >B</button>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); insertFormat('_'); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-slate-600 italic text-xs"
                >I</button>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); insertFormat('<u>', '</u>'); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-slate-600 underline text-xs"
                >U</button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <div className="relative">
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-slate-600 text-sm"
                    >😊</button>
                    {showEmojiPicker && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 shadow-xl rounded-xl p-2 grid grid-cols-5 gap-1 z-[100] w-40">
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => insertEmoji(e)} className="p-1.5 hover:bg-gray-100 rounded text-lg leading-none transition-colors">
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
             </div>

             {/* Input area */}
             <div className="p-2 sm:p-4">
                <div className="max-w-4xl mx-auto flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-200">
                        <form onSubmit={handleSendMessage} className="flex-1">
                            <input 
                                ref={inputRef}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                className="w-full bg-transparent text-xs sm:text-sm text-slate-700 outline-none py-1"
                                placeholder="Mesaj..."
                                autoComplete="off"
                            />
                        </form>
                    </div>
                    <button 
                        type="button"
                        onClick={() => handleSendMessage()}
                        onMouseDown={(e) => e.preventDefault()} 
                        disabled={!inputText.trim() && !selectedImage}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center transition-all shadow-md active:scale-90 disabled:opacity-50 disabled:bg-gray-400 shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
             </div>
         </div>
      </div>
      <UserListSidebar />
    </div>
  );
};

export default AiChatModule;