
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types.ts';
import { pb, sendMessageToPb, getRoomMessages, getAllUsers, banUser, kickUser, setUserOpStatus, getRoomMuteStatus, setRoomMuteStatus } from '../services/pocketbase.ts';

interface ChatInterfaceProps {
  currentUser: User;           
  topic: string;               
  participants: User[];        
  title?: string;
  roomId?: string; 
  isPrivate?: boolean;         
  isBlocked?: boolean; 
  onUserDoubleClick?: (user: User) => void; 
  onBlockUser?: () => void;
  onUnblockUser?: () => void;
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

const COLORS = [
    '#000000', // Siyah
    '#dc2626', // Kırmızı
    '#16a34a', // Yeşil
    '#2563eb', // Mavi
    '#9333ea', // Mor
    '#db2777', // Pembe
    '#ca8a04', // Sarı/Turuncu
    '#4b5563', // Gri
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  currentUser, 
  topic, 
  participants, 
  title, 
  roomId,
  isPrivate = false,
  isBlocked = false,
  onUserDoubleClick,
  onBlockUser,
  onUnblockUser
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [humanUsers, setHumanUsers] = useState<User[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [isRoomMuted, setIsRoomMuted] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    user: User | null;
  }>({ visible: false, x: 0, y: 0, user: null });

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentRoomId = roomId || (isPrivate ? `private_${currentUser.id}` : 'general');

  const fetchMessages = async () => {
      const history = await getRoomMessages(currentRoomId);
      if (history) {
          setMessages(prev => {
              if (prev.length === history.length && prev[prev.length-1]?.id === history[history.length-1]?.id) {
                  return prev;
              }
              return history;
          });
      }
  };

  const fetchUsers = async () => {
      const users = await getAllUsers();
      setHumanUsers(users);
  };

  const fetchRoomStatus = async () => {
     if (isPrivate) return;
     const status = await getRoomMuteStatus(currentRoomId);
     setIsRoomMuted(status);
  };

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    fetchRoomStatus();

    const intervalId = setInterval(() => {
        fetchMessages();
        fetchUsers();
        fetchRoomStatus();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [currentRoomId, isPrivate]);

  useEffect(() => {
    pb.collection('messages').subscribe('*', (e) => {
        if (e.record.room === currentRoomId) {
             fetchMessages();
        }
    }).catch(err => console.warn("Realtime sub failed", err));

    pb.collection('users').subscribe('*', (e) => {
        fetchUsers();
    }).catch(() => {});

    if (!isPrivate) {
        pb.collection('room_states').subscribe('*', (e) => {
            if (e.record.room_id === currentRoomId) {
                setIsRoomMuted(e.record.is_muted);
            }
        }).catch(() => {});
    }

    return () => { 
        pb.collection('messages').unsubscribe('*').catch(() => {});
        pb.collection('users').unsubscribe('*').catch(() => {});
        pb.collection('room_states').unsubscribe('*').catch(() => {});
    };
  }, [currentRoomId, isPrivate]);

  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    const uniqueUsers = new Map<string, User>();
    participants.forEach(p => uniqueUsers.set(p.id, p));
    humanUsers.forEach(u => { if (u.isOnline) uniqueUsers.set(u.id, u); });
    uniqueUsers.set(currentUser.id, currentUser);

    const sortedUsers = Array.from(uniqueUsers.values()).sort((a, b) => {
        if (a.id === currentUser.id) return -1;
        if (b.id === currentUser.id) return 1;
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.name.localeCompare(b.name);
    });

    setDisplayUsers(sortedUsers);
  }, [currentUser, participants, humanUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const execCommand = (command: string, value: string = '') => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (command === 'foreColor') setShowColorPicker(false);
  };

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { alert("Dosya boyutu 5MB'dan küçük olmalıdır."); return; }
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    if (!isPrivate || isBlocked) return; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => handleSendMessage(undefined, reader.result as string);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Mikrofon erişimi sağlanamadı.");
    }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleSendMessage = async (overrideText?: string, audioData?: string) => {
    if (isBlocked) return;
    if (isRoomMuted && !currentUser.isAdmin) return;
    const content = overrideText !== undefined ? overrideText : (editorRef.current?.innerHTML || '');
    const plainText = overrideText !== undefined ? overrideText : (editorRef.current?.innerText || '');
    if (!plainText.trim() && !selectedImage && !audioData) return;
    const userMsgPayload: Omit<Message, 'id'> = {
      senderId: currentUser.id, senderName: currentUser.name, senderAvatar: currentUser.avatar,
      text: audioData ? '🎤 Sesli Mesaj' : content, timestamp: new Date(), isUser: true,
      image: selectedImage || undefined, audio: audioData || undefined
    };
    if (editorRef.current && !audioData) editorRef.current.innerHTML = '';
    setSelectedImage(null);
    setShowEmojiPicker(false);
    setShowColorPicker(false);
    try {
      await sendMessageToPb(userMsgPayload, currentRoomId);
      fetchMessages();
    } catch (err) {}
  };

  const renderMessageContent = (msg: Message) => {
    return (
      <div className="rich-content break-words text-[14px] sm:text-[15px]">
         {msg.image && <div className="mb-2"><img src={msg.image} className="max-w-full rounded-lg max-h-64 object-cover" /></div>}
         {msg.audio ? (
            <div className="mb-1 flex items-center justify-center bg-gray-100/50 rounded-lg p-1 min-w-[240px]">
                <audio controls playsInline src={msg.audio} className="w-full h-10 rounded-lg outline-none" key={msg.id} />
            </div>
         ) : (
            <div dangerouslySetInnerHTML={{ __html: msg.text }} />
         )}
      </div>
    );
  };

  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    if (!currentUser.isAdmin && !currentUser.isOp) return;
    if (user.id === currentUser.id) return;
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, user: user });
  };

  const handleOpAction = async (targetUser: User) => {
      if (!currentUser.isAdmin) return;
      if (confirm(`${targetUser.name} adlı kullanıcıya ${targetUser.isOp ? 'Op Al' : 'Op Ver'}?`)) {
          try { await setUserOpStatus(targetUser.id, !targetUser.isOp); fetchUsers(); } catch(e) {}
      }
  };

  const handleKickAction = async (targetUser: User) => {
      if (confirm(`${targetUser.name} kişisini at (Kick)?`)) {
          try { await kickUser(targetUser.id); fetchUsers(); } catch(e) {}
      }
  };

  const handleBanAction = async (targetUser: User) => {
      if (confirm(`${targetUser.name} kişisini yasakla (Ban)?`)) {
          try { await banUser(targetUser.id, targetUser.email || ""); fetchUsers(); } catch(e) {}
      }
  };

  const handleToggleMute = async () => {
      if (!currentUser.isAdmin) return;
      const newStatus = !isRoomMuted;
      if (confirm(newStatus ? "Odayı sessize al?" : "Sessizliği kaldır?")) {
          try { await setRoomMuteStatus(currentRoomId, newStatus); fetchRoomStatus(); } catch (e) {}
      }
  };

  const inputDisabled = isBlocked || (isRoomMuted && !currentUser.isAdmin);

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 relative h-full border-r border-gray-50">
         <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h2>
                {isRoomMuted && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-bold">SESSİZ MOD</span>}
            </div>
            {currentUser.isAdmin && !isPrivate && (
                <button onClick={handleToggleMute} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isRoomMuted ? 'bg-red-500 text-white shadow-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {isRoomMuted ? "🔒 Odayı Aç" : "🔓 Sessize Al"}
                </button>
            )}
         </div>

         <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 bg-[#f8f9fa] touch-auto">
            {messages.map((msg, index) => {
                const isSystemMsg = msg.text.startsWith('system_msg|');
                if (isSystemMsg) {
                    const systemText = msg.text.split('system_msg|')[1];
                    return (
                        <div key={msg.id} className="w-full flex justify-center py-4 my-2 border-y border-blue-50/50">
                            <span className="text-blue-500 font-bold text-xs tracking-wide uppercase italic">
                                {systemText}
                            </span>
                        </div>
                    );
                }

                const isMe = msg.senderId === currentUser.id;
                const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId || messages[index-1].text.startsWith('system_msg|');
                return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className="shrink-0 mb-4"><img src={msg.senderAvatar} className="w-8 h-8 rounded-full shadow-sm bg-gray-200 border-2 border-white object-cover" /></div>
                        <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                             {showHeader && <span className="text-[9px] font-bold text-gray-400 mb-1 px-1 uppercase">{msg.senderName}</span>}
                             <div className={`px-4 py-2.5 shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-[20px] rounded-br-[4px]' : 'bg-white text-slate-700 rounded-[20px] rounded-bl-[4px] border border-gray-100'}`}>
                                {renderMessageContent(msg)}
                             </div>
                             <div className="text-[8px] text-gray-300 mt-1">{msg.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} className="h-4" />
         </div>

         <div className="bg-white border-t border-gray-100 p-2 sm:p-4 relative z-40">
             <div className="w-full">
                 {showEmojiPicker && (
                    <div className="absolute bottom-full left-4 mb-4 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 z-[999] w-72">
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">{EMOJIS.map(e => (<button key={e} onClick={() => insertEmoji(e)} className="p-1.5 hover:bg-blue-50 rounded text-xl">{e}</button>))}</div>
                    </div>
                 )}
                {showColorPicker && (
                    <div className="absolute bottom-full left-14 mb-4 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 z-[999]">
                        <div className="flex gap-2">{COLORS.map(c => (<button key={c} onClick={() => execCommand('foreColor', c)} className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110" style={{ backgroundColor: c }} />))}</div>
                    </div>
                 )}

                 <div className={`flex flex-col border rounded-2xl overflow-hidden transition-all bg-white shadow-sm ${inputDisabled ? 'border-red-200 bg-red-50/50' : 'border-gray-200 focus-within:border-blue-400'}`}>
                    {selectedImage && (
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-start gap-3">
                            <div className="relative group">
                                <img src={selectedImage} className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                            </div>
                        </div>
                    )}

                    <div className={`flex items-center gap-1 px-3 py-2 border-b border-gray-50 bg-gray-50/50 ${inputDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="w-10 h-9 rounded-lg hover:bg-white font-bold text-black">B</button>
                        <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="w-10 h-9 rounded-lg hover:bg-white italic text-black">I</button>
                        <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="w-10 h-9 rounded-lg hover:bg-white underline text-black">U</button>
                        <div className="w-px h-5 bg-gray-200 mx-2"></div>
                        <button onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); }} className="w-10 h-9 rounded-lg hover:bg-white">🎨</button>
                        <button onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }} className="w-10 h-9 rounded-lg hover:bg-white text-xl">😊</button>
                        {isPrivate && (
                            <>
                                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-9 rounded-lg hover:bg-white text-lg text-slate-600">📷</button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 p-2 relative">
                        {isRecording && <div className="absolute inset-0 bg-red-50 z-10 flex items-center justify-center gap-2 text-red-500 font-bold animate-pulse">Kaydediliyor... Bırakınca gönderilir.</div>}
                        <div 
                            ref={editorRef} contentEditable={!inputDisabled} 
                            className={`flex-1 min-h-[24px] max-h-[150px] overflow-y-auto outline-none text-[15px] text-slate-700 px-2 py-1 ${inputDisabled ? 'cursor-not-allowed text-gray-400 italic' : ''}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                            data-placeholder={isBlocked ? "Engellendi." : (isRoomMuted && !currentUser.isAdmin ? "🔒 Kapalı." : "Mesajınızı yazın...")} 
                        />
                        {isPrivate && (
                            <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} disabled={inputDisabled} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" /></svg>
                            </button>
                        )}
                        <button onClick={() => handleSendMessage()} disabled={inputDisabled} className={`w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 ${inputDisabled ? 'opacity-50 grayscale' : ''}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </div>
                 </div>
             </div>
         </div>
      </div>
      
      <div className="w-20 sm:w-64 bg-white border-l border-gray-100 flex flex-col shrink-0">
          <div className="p-2 sm:p-4 flex-1 overflow-y-auto">
            <h3 className="text-[8px] sm:text-[10px] font-black text-center sm:text-left text-gray-400 uppercase tracking-widest mb-4 truncate">Çevrimiçi Üyeler ({displayUsers.length})</h3>
            <div className="space-y-3">
                {displayUsers.map(u => (
                    <div key={u.id} className="flex flex-col sm:flex-row items-center sm:gap-3 p-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group" onDoubleClick={() => onUserDoubleClick?.(u)} onContextMenu={(e) => handleContextMenu(e, u)}>
                        <div className="relative">
                            <img src={u.avatar} className="w-8 h-8 rounded-full object-cover group-hover:ring-2 ring-blue-100 transition-all" />
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div className="min-w-0 w-full text-center sm:text-left">
                            <p className={`text-[10px] sm:text-sm font-bold truncate ${u.id === currentUser.id ? 'text-blue-600' : 'text-slate-700'}`}>
                                {u.isAdmin && <span className="text-red-500">🛡️</span>}
                                {u.isOp && !u.isAdmin && <span className="text-blue-500">⚡</span>}
                                {u.name}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
          </div>
      </div>

      {contextMenu.visible && contextMenu.user && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-[1000] bg-white border border-gray-200 shadow-xl rounded-lg py-1 min-w-[150px]">
              <div className="px-3 py-2 border-b bg-gray-50"><span className="text-xs font-bold text-gray-500">{contextMenu.user.name}</span></div>
              {currentUser.isAdmin && <button onClick={() => handleOpAction(contextMenu.user!)} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-slate-700 font-medium">{contextMenu.user.isOp ? '🔻 Op Al' : '⚡ Op Ver'}</button>}
              <button onClick={() => handleKickAction(contextMenu.user!)} className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 text-orange-600 font-medium">👢 At (Kick)</button>
              <button onClick={() => handleBanAction(contextMenu.user!)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 font-medium">🚫 Yasakla (Ban)</button>
          </div>
      )}
    </div>
  );
};

export default ChatInterface;