
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types.ts';
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
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [humanUsers, setHumanUsers] = useState<User[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentRoomId = roomId || (isPrivate ? `private_${currentUser.id}` : 'general');

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
                const newMsg: Message = {
                    id: e.record.id,
                    senderId: e.record.senderId,
                    senderName: e.record.senderName,
                    senderAvatar: e.record.senderAvatar,
                    text: e.record.text,
                    timestamp: new Date(e.record.created),
                    isUser: e.record.isUser,
                    image: e.record.image || undefined,
                    audio: e.record.audio || undefined
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

  // Kullanıcıları Birleştir
  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    
    // 1. Botları ekle (Artık boş gelecek ama mantık kalabilir)
    participants.forEach(p => uniqueUsers.set(p.id, p));
    
    // 2. Mesaj geçmişindeki kullanıcıları ekle
    messages.forEach(m => {
       if (!uniqueUsers.has(m.senderId)) {
           uniqueUsers.set(m.senderId, {
               id: m.senderId,
               name: m.senderName,
               avatar: m.senderAvatar,
               isBot: false
           });
       }
    });

    // 3. API'den gelen insanları ekle
    humanUsers.forEach(u => {
      uniqueUsers.set(u.id, u);
    });

    // 4. Kendimi ekle
    uniqueUsers.set(currentUser.id, currentUser);

    // Sıralama: Ben -> Diğerleri (Alfabetik)
    const sortedUsers = Array.from(uniqueUsers.values()).sort((a, b) => {
        if (a.id === currentUser.id) return -1;
        if (b.id === currentUser.id) return 1;
        return a.name.localeCompare(b.name);
    });

    setDisplayUsers(sortedUsers);
  }, [currentUser, participants, humanUsers, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const execCommand = (command: string, value: string = '') => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
          alert("Dosya boyutu 5MB'dan küçük olmalıdır.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AUDIO RECORDING LOGIC ---
  const startRecording = async () => {
    if (!isPrivate) return; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (audioBlob.size < 100) {
             stream.getTracks().forEach(track => track.stop());
             return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await handleSendMessage(undefined, base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mikrofon hatası:", err);
      alert("Mikrofon erişimi sağlanamadı veya tarayıcı desteklemiyor.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- SEND MESSAGE ---
  const handleSendMessage = async (overrideText?: string, audioData?: string) => {
    const content = overrideText !== undefined ? overrideText : (editorRef.current?.innerHTML || '');
    const plainText = overrideText !== undefined ? overrideText : (editorRef.current?.innerText || '');
    
    if ((!plainText.trim() && !selectedImage && !audioData) || isBlocked) return;

    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: audioData ? '🎤 Sesli Mesaj' : content,
      timestamp: new Date(),
      isUser: true,
      image: selectedImage || undefined,
      audio: audioData || undefined
    };

    if (editorRef.current && !audioData) editorRef.current.innerHTML = '';
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowEmojiPicker(false);
    
    try {
      await sendMessageToPb(userMsgPayload, currentRoomId);
    } catch (err) {
      console.error("Mesaj gönderme hatası:", err);
    }
  };

  const renderMessageContent = (msg: Message) => {
    return (
      <div className="rich-content break-words text-[14px] sm:text-[15px]">
         {msg.image && (
            <div className="mb-2">
                <img src={msg.image} alt="Paylaşılan Görsel" className="max-w-full rounded-lg max-h-64 object-cover border border-white/20" />
            </div>
         )}
         {msg.audio ? (
            <div className="mb-1 flex items-center justify-center bg-gray-100/50 rounded-lg p-1 min-w-[240px]">
                <audio 
                    controls 
                    playsInline 
                    src={msg.audio} 
                    className="w-full h-10 rounded-lg outline-none" 
                    key={msg.id}
                />
            </div>
         ) : (
            <div dangerouslySetInnerHTML={{ __html: msg.text }} />
         )}
         {msg.audio && <div className="text-[10px] opacity-60 font-bold uppercase tracking-wider mt-1 text-right">Sesli Mesaj</div>}
      </div>
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
                        <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && <span className="text-[9px] font-bold text-gray-400 mb-1 px-1 uppercase">{msg.senderName}</span>}
                             <div className={`
                                 px-4 py-2.5 shadow-sm
                                 ${isMe ? 'bg-blue-600 text-white rounded-[20px] rounded-br-[4px]' : 'bg-white text-slate-700 rounded-[20px] rounded-bl-[4px] border border-gray-100'}
                             `}>
                                {renderMessageContent(msg)}
                             </div>
                             <div className="text-[8px] text-gray-300 mt-1">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                )
            })}
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
                    {/* Seçilen Resim Önizleme */}
                    {selectedImage && (
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-start gap-3">
                            <div className="relative group">
                                <img src={selectedImage} alt="Önizleme" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                                <button 
                                    onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">Görsel eklendi</span>
                        </div>
                    )}

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
                        
                        {/* SADECE ÖZEL SOHBETTE RESİM ve SES */}
                        {isPrivate && (
                            <>
                                <button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="w-10 h-9 rounded-lg hover:bg-white hover:shadow-sm text-lg flex items-center justify-center transition-colors text-slate-600"
                                    title="Resim Ekle"
                                >
                                    📷
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileSelect} 
                                    accept="image/*" 
                                    className="hidden" 
                                />
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 p-2 relative">
                        {isRecording && (
                            <div className="absolute inset-0 bg-red-50 z-10 flex items-center justify-center gap-2 text-red-500 font-bold animate-pulse">
                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                Kaydediliyor... Bırakınca gönderilir.
                            </div>
                        )}
                        <div
                            ref={editorRef}
                            contentEditable
                            className="flex-1 min-h-[24px] max-h-[150px] overflow-y-auto outline-none text-[15px] text-slate-700 px-2 py-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            data-placeholder="Mesajınızı buraya yazın..."
                        />
                        
                        {/* Sesli Mesaj Butonu (Bas-Konuş) */}
                        {isPrivate && (
                            <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onMouseLeave={stopRecording}
                                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0 ${isRecording ? 'bg-red-500 text-white scale-110' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                title="Basılı tutarak konuşun"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}

                        <button 
                            onClick={() => handleSendMessage()}
                            className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                 </div>
             </div>
         </div>
      </div>
      
      {/* KULLANICI LİSTESİ SIDEBAR */}
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
                        <img src={u.avatar} className="hidden sm:block w-8 h-8 rounded-full object-cover group-hover:ring-2 ring-blue-100 transition-all" />
                        
                        <div className="min-w-0 w-full text-center sm:text-left">
                            <p className={`text-[10px] sm:text-sm font-bold truncate ${u.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>
                                {u.name}
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
