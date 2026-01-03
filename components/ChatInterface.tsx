import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { generateGroupResponse } from '../services/geminiService';

/**
 * AiChatModule Props
 * Bu bileşeni başka bir uygulamaya entegre ederken bu props'ları kullanacaksınız.
 */
interface AiChatModuleProps {
  currentUser: User;           // Sohbet eden gerçek kullanıcı
  topic: string;               // Sohbetin konusu
  participants: User[];        // Sohbete dahil olacak botların listesi
  title?: string;              // Opsiyonel: Başlık
  height?: string;             // Opsiyonel: Yükseklik (default: 100%)
  onClose?: () => void;        // Opsiyonel: Kapatma/Geri butonu işlevi
  
  // Yeni Props
  isPrivate?: boolean;         // Özel oda mı?
  isBlocked?: boolean;         // Karşıdaki kişi engelli mi?
  onBlockUser?: () => void;    // Engelleme fonksiyonu
  onUnblockUser?: () => void;  // Engeli kaldırma fonksiyonu
  onUserDoubleClick?: (user: User) => void; // Kullanıcıya çift tıklama
}

const AiChatModule: React.FC<AiChatModuleProps> = ({ 
  currentUser, 
  topic, 
  participants, 
  title, 
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial greeting
  useEffect(() => {
    // Sohbet her başladığında veya konu değiştiğinde sistemi sıfırla
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
    setInputText('');
    setSelectedImage(null);
  }, [currentUser, topic, isPrivate, participants]);

  // Hourly Cleanup Logic (Sadece Genel Odalar İçin)
  useEffect(() => {
    if (isPrivate) return;

    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 Saat

    const cleanupInterval = setInterval(() => {
      setMessages((prevMessages) => {
        if (prevMessages.length <= 1) return prevMessages;

        console.log("Saat başı temizlik çalıştı: Sohbet geçmişi sıfırlandı.");

        const cleanupMsg: Message = {
            id: `system-cleanup-${Date.now()}`,
            senderId: 'system',
            senderName: 'Sistem',
            senderAvatar: '',
            text: 'Performans optimizasyonu için sohbet geçmişi otomatik olarak temizlendi (Saat başı temizlik).',
            timestamp: new Date(),
            isUser: false,
        };

        return [cleanupMsg];
      });
    }, ONE_HOUR_MS);

    return () => clearInterval(cleanupInterval);
  }, [isPrivate]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, selectedImage]);

  // Focus input on mount
  useEffect(() => {
    if (!isBlocked) {
        inputRef.current?.focus();
    }
  }, [isBlocked]);

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

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isBlocked) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: inputText,
      image: selectedImage || undefined,
      timestamp: new Date(),
      isUser: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
    setIsTyping(true);

    try {
      // Doğallık için kısa bekleme
      await new Promise(resolve => setTimeout(resolve, 600));

      const updatedHistory = [...messages, userMsg];
      
      // Servis çağrısı - Botların cevap üretmesi
      const botResponses = await generateGroupResponse(
        updatedHistory,
        participants,
        topic,
        currentUser.name
      );

      setIsTyping(false);

      if (botResponses.length > 0) {
        // Bot cevaplarını sırayla ve okuma hızı simülasyonu ile ekle
        for (const resp of botResponses) {
          const bot = participants.find((p) => p.id === resp.botId);
          if (bot) {
            setIsTyping(true);
            // Karakter sayısına göre bekleme süresi (min 800ms, max 2.5sn)
            await new Promise(resolve => setTimeout(resolve, Math.min(2500, Math.max(800, resp.message.length * 20))));
            setIsTyping(false);

            const botMsg: Message = {
              id: Date.now() + Math.random().toString(),
              senderId: bot.id,
              senderName: bot.name,
              senderAvatar: bot.avatar,
              text: resp.message,
              timestamp: new Date(),
              isUser: false,
            };
            setMessages((prev) => [...prev, botMsg]);
          }
        }
      }
    } catch (err) {
      console.error("Modül hatası:", err);
      setIsTyping(false);
    }
  };

  // Combine currentUser and participants for the list
  const allUsersInRoom = [currentUser, ...participants];

  // Reusable User List Component Logic
  const UserListContent = (
    <ul className="divide-y divide-gray-100">
      {allUsersInRoom.map((user) => (
        <li 
            key={user.id} 
            className="p-2 hover:bg-white hover:shadow-sm cursor-pointer transition-colors group flex items-center gap-2 select-none"
            onDoubleClick={() => {
                // Kendi ismine tıklarsa bir şey yapma, bot ise tetikle
                if (user.id !== currentUser.id && onUserDoubleClick) {
                    onUserDoubleClick(user);
                }
            }}
            title={user.id !== currentUser.id ? "Özel mesaj için çift tıkla" : ""}
        >
            {/* Avatar */}
            <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-md object-cover" />
                {/* Online Status Dot */}
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            
            {/* Name & Role */}
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
          
          {/* Private Chat Block Button */}
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

          {/* Mobile User List Toggle Button */}
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

      {/* Main Content Area (Split: Chat | UserList) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Column: Messages & Input */}
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
                            
                            {/* Render Image if exists */}
                            {msg.image && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                    <img src={msg.image} alt="Sent attachment" className="max-w-full h-auto max-h-60 object-contain" />
                                </div>
                            )}

                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                            <span className={`text-[10px] mt-1 block text-right opacity-60`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        </div>
                    </div>
                );
                })}

                {/* Typing Indicator */}
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

            {/* Input Area */}
            <div className="bg-slate-50 border-t border-gray-200 p-3 z-10">
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
                    
                    {/* Image Upload Button - Only for Private Rooms */}
                    {isPrivate && (
                        <>
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
                                className={`p-2.5 rounded-lg border transition-all ${
                                    isBlocked 
                                    ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-500 border-gray-300 hover:text-indigo-600 hover:border-indigo-500'
                                }`}
                                title="Resim Gönder"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </>
                    )}

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