import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types.ts';
import { generateGroupResponse } from '../services/geminiService.ts';
import { pb, sendMessageToPb, getRoomMessages } from '../services/pocketbase.ts';

/**
 * AiChatModule Props
 */
interface AiChatModuleProps {
  currentUser: User;           
  topic: string;               
  participants: User[];        
  title?: string;
  roomId?: string; // Room ID for DB queries
  height?: string;             
  onClose?: () => void;        
  
  isPrivate?: boolean;         
  isBlocked?: boolean;         
  onBlockUser?: () => void;    
  onUnblockUser?: () => void;  
  onUserDoubleClick?: (user: User) => void; 
}

// Common emojis for the picker
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
  height = "h-full", 
  onClose,
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
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const currentRoomId = roomId || (isPrivate ? `private_${currentUser.id}` : 'general');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sound Effect Initialization
  useEffect(() => {
    // Simple notification beep
    audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_73b3780373.mp3'); // Short beep sound
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
  };

  // Load History and Subscribe to Realtime
  useEffect(() => {
    // 1. Load History
    const loadHistory = async () => {
        const history = await getRoomMessages(currentRoomId);
        if (history.length > 0) {
            setMessages(history);
        } else {
             // Initial greeting if empty
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
             // Don't save system message to DB, just local view
             setMessages([greeting]);
        }
    };
    loadHistory();

    // 2. Subscribe
    pb.collection('messages').subscribe('*', function (e) {
        if (e.action === 'create' && e.record.room === currentRoomId) {
            // Check if we already have this message (optimistic update prevention)
            setMessages(prev => {
                if (prev.some(m => m.id === e.record.id)) return prev;
                
                // Play sound if not my message
                if (e.record.senderId !== currentUser.id) {
                    playNotificationSound();
                }

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


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, selectedImage]);

  // Focus input
  useEffect(() => {
    if (!isBlocked) {
        inputRef.current?.focus();
    }
  }, [isBlocked]);

  // Click outside listener for emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    
    const newText = 
      inputText.substring(0, start) + 
      textToInsert + 
      inputText.substring(end);
    
    setInputText(newText);
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + textToInsert.length;
      input.focus();
    }, 0);
  };

  const wrapSelection = (tagStart: string, tagEnd: string) => {
    if (!inputRef.current) return;
    const input = inputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    
    if (start === end) {
        insertAtCursor(`${tagStart}${tagEnd}`);
        return;
    }

    const selectedText = inputText.substring(start, end);
    const newText = 
      inputText.substring(0, start) + 
      tagStart + selectedText + tagEnd + 
      inputText.substring(end);
      
    setInputText(newText);
    setTimeout(() => {
        input.selectionStart = input.selectionEnd = end + tagStart.length + tagEnd.length;
        input.focus();
    }, 0);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isBlocked) return;

    // 1. Prepare User Message
    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: inputText,
      image: selectedImage || undefined,
      timestamp: new Date(),
      isUser: true,
    };

    // Optimistically update UI? 
    // PocketBase realtime is fast, but let's clear input immediately
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    try {
      // 2. Save User Message to PocketBase
      // The realtime subscription will eventually update the UI, but we can do it optimistically too if needed.
      // We rely on subscription for consistency here to avoid duplicates if network is fast.
      await sendMessageToPb(userMsgPayload, currentRoomId);
      
      // 3. Trigger Bot Logic
      setIsTyping(true);

      // Fetch current state from messages (state might be slightly stale compared to DB but acceptable for context)
      // We need to append the user message manually to context since DB roundtrip might be pending
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
            // Artificial delay for realism
            setIsTyping(true);
            await new Promise(resolve => setTimeout(resolve, Math.min(2500, Math.max(800, resp.message.length * 20))));
            setIsTyping(false);

            // 4. Save Bot Message to PocketBase
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

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('__') && part.endsWith('__')) {
            return <u key={index} className="underline decoration-2">{part.slice(2, -2)}</u>;
        } else if (part.startsWith('*') && part.endsWith('*')) {
            if(part.length > 2) return <em key={index} className="italic">{part.slice(1, -1)}</em>;
            return part;
        }
        return part;
    });
  };

  const allUsersInRoom = [currentUser, ...participants];

  const UserListContent = (
    <ul className="divide-y divide-gray-100">
      {allUsersInRoom.map((user) => (
        <li 
            key={user.id} 
            className="p-2 hover:bg-white hover:shadow-sm cursor-pointer transition-colors group flex items-center gap-2 select-none"
            onDoubleClick={() => {
                if (user.id !== currentUser.id && onUserDoubleClick) {
                    onUserDoubleClick(user);
                }
            }}
            title={user.id !== currentUser.id ? "Özel mesaj için çift tıkla" : ""}
        >
            <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-md object-cover" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                    {user.isBot && (
                        <span className="text-indigo-600 font-bold" title="Bot/Operatör">@</span>
                    )}
                    <p className={`text-sm truncate ${user.id === currentUser.id ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                        {user.name}
                    </p>
                </div>
                {user.isBot && user.role && (
                    <p className="text-[10px] text-gray-400 truncate group-hover:text-indigo-500">
                        {user.role}
                    </p>
                )}
            </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`flex flex-col bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm relative ${height}`}>
      
      {/* Module Header */}
      <header className="bg-slate-800 text-white border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0 z-20 relative">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {isPrivate ? (
                <span className="text-green-400">●</span>
            ) : (
                <span className="text-slate-400">#</span>
            )}
            {title || topic || 'Sohbet'}
          </h2>
          <p className="text-xs text-slate-400">
             {topic}
          </p>
        </div>
        <div className="flex items-center gap-3">
          
          {isPrivate && (
              <button
                onClick={isBlocked ? onUnblockUser : onBlockUser}
                className={`text-xs px-3 py-1.5 rounded font-medium transition-colors border ${
                    isBlocked 
                    ? 'border-green-600 text-green-400 hover:bg-green-900' 
                    : 'border-red-500 text-red-400 hover:bg-red-900'
                }`}
              >
                {isBlocked ? 'Engeli Kaldır' : 'Engelle'}
              </button>
          )}

          <button 
            className="md:hidden text-gray-300 hover:text-white p-1"
            onClick={() => setShowMobileUserList(!showMobileUserList)}
            title="Kullanıcı Listesi"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors"
              title="Kapat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        <div className="flex flex-col flex-1 w-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white relative">
                {messages.map((msg) => {
                if (msg.senderId === 'system') {
                    return (
                        <div key={msg.id} className="flex justify-center my-2">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-medium border-b border-slate-100 pb-1">
                                {msg.text}
                            </span>
                        </div>
                    )
                }
                
                return (
                    <div
                        key={msg.id}
                        className={`flex w-full ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
                        
                        <div className="flex-shrink-0 mt-1">
                            <img 
                            src={msg.senderAvatar} 
                            alt={msg.senderName} 
                            className="w-8 h-8 rounded-full object-cover border border-gray-100"
                            />
                        </div>

                        <div
                            className={`flex flex-col p-2.5 px-4 rounded-xl text-sm shadow-sm ${
                            msg.isUser
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-slate-100 text-slate-800 rounded-tl-none'
                            }`}
                        >
                            {!msg.isUser && (
                            <span className="text-xs font-bold text-indigo-600 mb-0.5 cursor-pointer hover:underline">
                                {msg.senderName}
                            </span>
                            )}
                            
                            {msg.image && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                    <img src={msg.image} alt="Sent attachment" className="max-w-full h-auto max-h-60 object-contain" />
                                </div>
                            )}

                            <p className="whitespace-pre-wrap leading-relaxed">
                                {renderFormattedText(msg.text)}
                            </p>
                            <span className={`text-[10px] mt-1 block text-right opacity-60`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        </div>
                    </div>
                );
                })}

                {isTyping && (
                <div className="flex w-full justify-start pl-10">
                        <div className="bg-slate-100 p-2 px-4 rounded-full flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Formatting Toolbar & Input Area */}
            <div className="bg-slate-50 border-t border-gray-200 p-2 z-10">
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-2 px-1 relative">
                    <div className="relative" ref={emojiContainerRef}>
                        <button 
                            type="button" 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                            title="İfadeler"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-500">
                                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a6.765 6.765 0 00-.16.6h2.192c0-.222-.063-.405-.16-.604-.108-.215-.395-.63-.936-.63zm4.388.634c.108.215.395.63.936.63.54 0 .828-.419.936-.634a6.765 6.765 0 00.16-.6h-2.192c0 .222.063.405.16.604zm-1.121 6.545a1.125 1.125 0 011.603 0 4.125 4.125 0 010 5.835 1.125 1.125 0 01-1.603-1.602 1.875 1.875 0 000-2.631 1.125 1.125 0 010-1.602z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {showEmojiPicker && (
                            <div className="absolute bottom-10 left-0 bg-white border border-gray-200 shadow-xl rounded-lg p-3 w-64 z-50 grid grid-cols-6 gap-2 h-48 overflow-y-auto">
                                {EMOJIS.map((emoji) => (
                                    <button 
                                        key={emoji} 
                                        onClick={() => {
                                            insertAtCursor(emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        className="text-xl hover:bg-slate-100 rounded p-1"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-gray-300 mx-1"></div>

                    <button 
                        type="button" 
                        onClick={() => wrapSelection('**', '**')}
                        className="p-1.5 hover:bg-slate-200 rounded font-bold text-slate-700 w-8 text-center"
                        title="Kalın (Bold)"
                    >
                        B
                    </button>
                    <button 
                        type="button" 
                        onClick={() => wrapSelection('*', '*')}
                        className="p-1.5 hover:bg-slate-200 rounded italic text-slate-700 w-8 text-center font-serif"
                        title="İtalik"
                    >
                        I
                    </button>
                    <button 
                        type="button" 
                        onClick={() => wrapSelection('__', '__')}
                        className="p-1.5 hover:bg-slate-200 rounded underline text-slate-700 w-8 text-center"
                        title="Altı Çizili"
                    >
                        U
                    </button>
                    
                    {isPrivate && (
                        <>
                             <div className="h-4 w-px bg-gray-300 mx-1"></div>
                             <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageSelect}
                                disabled={isBlocked}
                             />
                             <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isBlocked}
                                className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Resim Gönder"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                                </svg>
                             </button>
                        </>
                    )}
                </div>

                {/* Image Preview */}
                {selectedImage && (
                    <div className="mb-2 flex items-center gap-2 p-2 bg-slate-200 rounded-lg w-fit">
                        <img src={selectedImage} alt="Preview" className="h-12 w-12 object-cover rounded" />
                        <button 
                            onClick={() => {
                                setSelectedImage(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="text-slate-500 hover:text-red-500 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isBlocked ? "Kullanıcı engellendi." : (selectedImage ? "Resim hakkında bir şeyler yazın..." : "Mesajınızı yazın...")}
                        disabled={isBlocked}
                        className={`flex-1 text-sm border rounded-lg py-2.5 px-4 transition-all outline-none ${
                            isBlocked 
                            ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed' 
                            : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                        }`}
                    />
                    <button
                        type="submit"
                        disabled={(!inputText.trim() && !selectedImage) || isTyping || isBlocked}
                        className={`p-2.5 rounded-lg text-white transition-all ${
                            (inputText.trim() || selectedImage) && !isTyping && !isBlocked
                            ? 'bg-indigo-600 hover:bg-indigo-700' 
                            : 'bg-gray-300 cursor-not-allowed'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>

        {/* Desktop User List (Sidebar) */}
        <aside className="w-52 bg-slate-50 border-l border-gray-200 overflow-y-auto hidden md:block shrink-0">
            <div className="p-2 border-b border-gray-200 bg-slate-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Kişiler ({allUsersInRoom.length})
                </span>
            </div>
            {UserListContent}
        </aside>

        {/* Mobile User List (Drawer/Overlay) */}
        {showMobileUserList && (
          <div className="absolute inset-0 z-50 flex justify-end md:hidden">
             {/* Backdrop */}
             <div 
               className="absolute inset-0 bg-black/40 backdrop-blur-sm"
               onClick={() => setShowMobileUserList(false)}
             ></div>
             
             {/* Drawer Content */}
             <div className="relative w-64 bg-slate-50 h-full shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
                <div className="p-3 border-b border-gray-200 bg-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Kişiler ({allUsersInRoom.length})
                    </span>
                    <button 
                        onClick={() => setShowMobileUserList(false)}
                        className="text-gray-500 hover:text-red-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {UserListContent}
                </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AiChatModule;