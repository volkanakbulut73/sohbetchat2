
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

  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    uniqueUsers.set(currentUser.id, currentUser);
    participants.forEach(p => uniqueUsers.set(p.id, p));
    setDisplayUsers(Array.from(uniqueUsers.values()));
  }, [currentUser, participants]);

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
      const botResponses = await generateGroupResponse(
        [...messages, { ...userMsgPayload, id: 'temp' }], 
        participants, 
        topic, 
        currentUser.name
      );
      setIsTyping(false);

      if (botResponses) {
        for (const resp of botResponses) {
          const bot = participants.find((p) => p.id === resp.botId);
          if (bot) {
            setIsTyping(true);
            await new Promise(resolve => setTimeout(resolve, 1500));
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
      <div className="flex-1 flex flex-col min-w-0 relative h-full border-r border-gray-50">
         <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-30 shrink-0">
             <div className="min-w-0">
                 <h2 className="text-xs sm:text-sm font-bold text-slate-800 truncate">{title || topic}</h2>
                 <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">{topic}</p>
             </div>
         </div>

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
            {isTyping && <div className="ml-10 bg-white px-3 py-1.5 rounded-full w-fit shadow-sm border border-gray-50 animate-pulse text-[10px] text-blue-500 font-bold">Yazıyor...</div>}
            <div ref={messagesEndRef} className="h-4" />
         </div>

         {/* ZENGİN METİN GİRİŞ ALANI */}
         <div className="bg-white border-t border-gray-100 p-2 sm:p-4 relative z-40">
             <div className="max-w-4xl mx-auto">
                 
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
                    {/* ARAÇ ÇUBUĞU - BUTONLAR SİYAH YAPILDI */}
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

                    {/* DÜZENLENEBİLİR ALAN */}
                    <div className="flex items-center gap-2 p-3">
                        {/* Fix: Changed placeholder to data-placeholder because div elements don't support placeholder attribute in TypeScript. 
                            HTML5 contentEditable divs do not have a standard 'placeholder' property. */}
                        <div
                            ref={editorRef}
                            contentEditable
                            className="flex-1 min-h-[40px] max-h-[150px] overflow-y-auto outline-none text-[15px] text-slate-700 px-1 py-1"
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
                            className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center transition-all shadow active:scale-95 shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-2 px-1">Artık yazarken stiliniz anında görünür!</p>
             </div>
         </div>
      </div>
      
      {/* ÜYE LİSTESİ */}
      <div className="hidden sm:flex flex-col w-64 border-l border-gray-100 bg-white p-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Üyeler</h3>
          <div className="space-y-3 overflow-y-auto">
              {displayUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                      <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" />
                      <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{u.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase">{u.isBot ? 'Bot' : 'İnsan'}</p>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default AiChatModule;
