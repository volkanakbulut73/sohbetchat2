
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types.ts';
import { generateGroupResponse } from '../services/geminiService.ts';
import { generateSocratesResponse } from '../services/grokService.ts';
import { pb, sendMessageToPb, getRoomMessages, getAllUsers } from '../services/pocketbase.ts';

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

const EMOJIS = [
  '😊', '😂', '🤣', '❤️', '😍', '👍', '🙌', '👏', '🔥', '✨',
  '🤔', '😎', '😢', '😮', '😡', '🙏', '💯', '🚀', '✅', '❌',
  '👀', '🎉', '🌟', '💪', '🍦', '🍕', '🌍', '🎮', '💡', '🎵',
  '🌈', '⚡', '🌙', '🎨', '💼', '⏰', '📌', '🎁', '🎈', '💬',
  '🦁', '🐱', '🐶', '🦄', '🍎', '🍓', '🍔', '🍺', '⚽', '🏀',
  '🎸', '📸', '✈️', '🏝️', '🏠', '💻', '📱', '🔒', '🔑', '❤️‍🔥',
  '🥺', '🤫', '🤯', '🥳', '🥶', '🤡', '👻', '👽', '👾', '🤖',
  '🤝', '💍', '💎', '💰', '📈', '📍', '🗺️', '⏰', '🔋', '🔌'
];

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
  const [isTyping, setIsTyping] = useState(false);
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [humanUsers, setHumanUsers] = useState<User[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
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

  // Mesaj Geçmişi ve Mesaj Aboneliği
  useEffect(() => {
    const loadHistory = async () => {
        const history = await getRoomMessages(currentRoomId);
        setMessages(history.length > 0 ? history : []);
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

    return () => { pb.collection('messages').unsubscribe('*'); };
  }, [currentRoomId, currentUser]);

  // Kullanıcı Listesi ve Kullanıcı Aboneliği
  useEffect(() => {
    const fetchUsers = async () => {
      const users = await getAllUsers();
      setHumanUsers(users);
    };

    fetchUsers();

    // Yeni kullanıcılar kayıt olduğunda listeyi güncelle
    const unsubscribe = pb.collection('users').subscribe('*', (e) => {
      fetchUsers();
    });

    return () => { pb.collection('users').unsubscribe('*'); };
  }, []);

  // Botlar, Mevcut Kullanıcı ve Diğer İnsanları Birleştir
  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    
    // 1. Botları ekle
    participants.forEach(p => uniqueUsers.set(p.id, p));
    
    // 2. Diğer insanları ekle
    humanUsers.forEach(u => {
      if (!uniqueUsers.has(u.id)) {
        uniqueUsers.set(u.id, u);
      }
    });

    // 3. Kendimi ekle (her ihtimale karşı listenin başında veya sonunda olsun diye)
    uniqueUsers.set(currentUser.id, currentUser);

    setDisplayUsers(Array.from(uniqueUsers.values()));
  }, [currentUser, participants, humanUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const execCommand = (command: string, value: string = '') => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
  };

  const handleSendMessage = async () => {
    const content = editorRef.current?.innerHTML || '';
    const plainText = editorRef.current?.innerText || '';
    
    if (!plainText.trim() || isBlocked) return;

    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: content,
      timestamp: new Date(),
      isUser: true,
    };

    if (editorRef.current) editorRef.current.innerHTML = '';
    setShowEmojiPicker(false);
    
    try {
      await sendMessageToPb(userMsgPayload, currentRoomId);
      
      setIsTyping(true);
      const currentMessages = [...messages, { ...userMsgPayload, id: 'temp' }];
      const botResponses = await generateGroupResponse(
        currentMessages, 
        participants, 
        topic, 
        currentUser.name
      );

      if (botResponses && botResponses.length > 0) {
        for (const resp of botResponses) {
          const bot = participants.find((p) => p.id === resp.botId);
          if (bot) {
            setIsTyping(true);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let finalMessage = resp.message;
            
            if (bot.id === 'bot_socrates') {
              finalMessage = await generateSocratesResponse(currentMessages, currentUser.name);
            }

            await sendMessageToPb({
                senderId: bot.id,
                senderName: bot.name,
                senderAvatar: bot.avatar,
                text: finalMessage,
                timestamp: new Date(),
                isUser: false
            }, currentRoomId);
          }
        }
      }
      setIsTyping(false);
    } catch (err) {
      console.error("Hata:", err);
      setIsTyping(false);
    }
  };

  const renderMessageContent = (html: string) => {
    return (
      <div 
        className="rich-content break-words text-[14px] sm:text-[15px]"
        dangerouslySetInnerHTML={{ __html: html }} 
      />
    );
  };

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      
      {/* SOHBET ALANI */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full border-r border-gray-50">
         
         <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-[#f8f9fa] touch-auto">
            {messages.map((msg, index) => {
                const isMe = msg.senderId === currentUser.id;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1`}>
                        <div className="shrink-0 mb-4">
                            <img src={msg.senderAvatar} className="w-8 h-8 rounded-full shadow-sm bg-gray-200 object-cover border-2 border-white" />
                        </div>
                        <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && <span className="text-[9px] font-bold text-gray-400 mb-1 px-1 uppercase">{msg.senderName}</span>}
                             <div className={`
                                 px-4 py-2.5 shadow-sm
                                 ${isMe ? 'bg-blue-600 text-white rounded-[20px] rounded-br-[4px]' : 'bg-white text-slate-700 rounded-[20px] rounded-bl-[4px] border border-gray-100'}
                             `}>
                                {renderMessageContent(msg.text)}
                             </div>
                             <div className="text-[8px] text-gray-300 mt-1">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                )
            })}
            {isTyping && <div className="ml-10 bg-white px-3 py-1.5 rounded-full w-fit shadow-sm border border-gray-100 animate-pulse text-[10px] text-blue-500 font-bold">Yazıyor...</div>}
            <div ref={messagesEndRef} className="h-4" />
         </div>

         <div className="bg-white border-t border-gray-100 p-2 sm:p-4 relative z-40">
             <div className="w-full">
                 
                 {showEmojiPicker && (
                    <div className="absolute bottom-full left-4 mb-4 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 z-[999] w-72">
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => insertEmoji(e)} className="p-1.5 hover:bg-blue-50 rounded text-xl">{e}</button>
                            ))}
                        </div>
                    </div>
                 )}

                 <div className="flex flex-col border border-gray-200 rounded-2xl overflow-hidden focus-within:border-blue-400 transition-all bg-white shadow-sm">
                    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50/50">
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} 
                            className="w-10 h-9 rounded-lg hover:bg-white hover:shadow-sm font-bold text-black text-base transition-colors"
                        >B</button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} 
                            className="w-10 h-9 rounded-lg hover:bg-white hover:shadow-sm italic text-black text-base transition-colors"
                        >I</button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} 
                            className="w-10 h-9 rounded-lg hover:bg-white hover:shadow-sm underline text-black text-base transition-colors"
                        >U</button>
                        <div className="w-px h-5 bg-gray-200 mx-2"></div>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }} 
                            className="w-10 h-9 rounded-lg hover:bg-white hover:shadow-sm text-xl"
                        >😊</button>
                    </div>

                    <div className="flex items-center gap-2 p-3">
                        <div
                            ref={editorRef}
                            contentEditable
                            className="flex-1 min-h-[60px] max-h-[250px] overflow-y-auto outline-none text-[16px] text-slate-700 px-1 py-2"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            data-placeholder="Mesajınızı buraya yazın..."
                        />
                        <button 
                            onClick={handleSendMessage}
                            className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                 </div>
             </div>
         </div>
      </div>
      
      {/* KULLANICI LİSTESİ SIDEBAR */}
      {/* Mobilde w-20 (80px), Masaüstünde w-64 (256px) - Her zaman görünür */}
      <div className="w-20 sm:w-64 bg-white border-l border-gray-100 flex flex-col shrink-0 transition-all duration-300">
          <div className="p-2 sm:p-4 flex-1 overflow-y-auto">
            <h3 className="text-[8px] sm:text-[10px] font-black text-center sm:text-left text-gray-400 uppercase tracking-widest mb-2 sm:mb-4 truncate">
                Üyeler <span className="hidden sm:inline">({displayUsers.length})</span>
            </h3>
            <div className="space-y-2 sm:space-y-3">
                {displayUsers.map(u => (
                    <div 
                        key={u.id} 
                        className="flex flex-col sm:flex-row items-center sm:gap-3 p-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                        onDoubleClick={() => onUserDoubleClick?.(u)}
                    >
                        {/* Avatar: Mobilde gizle (hidden), sm ve üzerinde göster */}
                        <img src={u.avatar} className="hidden sm:block w-8 h-8 rounded-full object-cover group-hover:ring-2 ring-blue-100 transition-all" />
                        
                        <div className="min-w-0 w-full text-center sm:text-left">
                            {/* İsim: Mobilde 10px, Masaüstünde normal */}
                            <p className={`text-[10px] sm:text-sm font-bold truncate ${u.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>
                                {u.name}
                            </p>
                            {/* Rol: Mobilde gizle, Masaüstünde göster */}
                            <p className="hidden sm:block text-[10px] text-gray-400 uppercase tracking-tighter">
                                {u.isBot ? 'Yapay Zeka' : 'İnsan'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
          </div>
      </div>
    </div>
  );
};

export default AiChatModule;
