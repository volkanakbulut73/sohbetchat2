import React, { useState } from 'react';
import JoinScreen from './components/JoinScreen';
import AiChatModule from './components/ChatInterface';
import { User, ChatRoom } from './types';

/**
 * Bu "App" bileşeni, AiChatModule'ü entegre eden ana uygulamayı temsil eder.
 * Gerçek senaryoda burası sizin "Dashboard" veya "HomePage" sayfanız olabilir.
 */
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [blockedBotIds, setBlockedBotIds] = useState<Set<string>>(new Set());

  // Uygulama içi kullanıcı girişi simülasyonu
  const handleJoin = (name: string, room: ChatRoom) => {
    const avatarUrl = `https://picsum.photos/seed/${name}-${Date.now()}/200/200`;
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      avatar: avatarUrl,
      isBot: false,
    };
    setUser(newUser);
    setActiveRoom(room);
  };

  const handleCloseModule = () => {
    // Eğer özel bir odadaysak ve ana odaya dönmek istiyorsak, burada mantık kurulabilir.
    // Şimdilik sadece odayı kapatıyoruz.
    setActiveRoom(null);
  };

  const handleUserDoubleClick = (targetUser: User) => {
    // Kendi kendine özel mesaj atamazsın (ChatInterface'de de engelli ama burada da kontrol edelim)
    if (!user || targetUser.id === user.id) return;

    // Geçici bir "Özel Oda" oluştur
    const privateRoom: ChatRoom = {
        id: `private_${user.id}_${targetUser.id}`,
        name: targetUser.name,
        topic: 'Özel Sohbet',
        description: `${targetUser.name} ile özel sohbet`,
        participants: [targetUser], // Sadece hedef kullanıcı (bot) katılımcı olarak eklenir
        isPrivate: true
    };
    
    setActiveRoom(privateRoom);
  };

  const toggleBlock = (userId: string) => {
    setBlockedBotIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        return newSet;
    });
  };

  // Eğer kullanıcı giriş yapmamışsa (login ekranı)
  if (!user) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  // Şu anki odada, tek bir katılımcı varsa ve bu bot ise, engelli mi diye kontrol et
  const isCurrentPeerBlocked = activeRoom?.isPrivate && activeRoom.participants.length > 0 
    ? blockedBotIds.has(activeRoom.participants[0].id)
    : false;

  // Kullanıcı giriş yaptı, ana uygulama arayüzünü göster
  return (
    <div className="h-screen w-full bg-slate-200 flex flex-col md:flex-row">
      
      {/* Sol Sidebar (Örnek Ana Uygulama Menüsü) */}
      <div className="w-full md:w-64 bg-slate-800 text-white p-6 hidden md:block">
        <h1 className="text-2xl font-bold mb-8">Ana Uygulama</h1>
        <div className="flex items-center gap-3 mb-8 bg-slate-700 p-3 rounded-lg">
           <img src={user.avatar} className="w-10 h-10 rounded-full" />
           <div>
              <div className="font-bold text-sm">{user.name}</div>
              <div className="text-xs text-slate-400">Online</div>
           </div>
        </div>
        <nav className="space-y-4">
          <div className="block p-2 bg-slate-700 rounded cursor-pointer">Panel</div>
          <div className="block p-2 hover:bg-slate-700 rounded cursor-pointer opacity-50">Ayarlar</div>
        </nav>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden relative">
        
        {/* Eğer bir oda seçiliyse Modülü Göster, değilse Placeholder göster */}
        {activeRoom ? (
          <div className="w-full max-w-4xl mx-auto h-full shadow-2xl rounded-xl overflow-hidden">
             {/* 
                 >>> ENTEGRASYON NOKTASI <<<
                 AiChatModule bileşenini burada kullanıyoruz.
             */}
             <AiChatModule 
                currentUser={user}
                topic={activeRoom.topic}
                participants={activeRoom.participants}
                title={activeRoom.name}
                onClose={handleCloseModule}
                height="h-full"
                
                // Yeni Özellikler
                onUserDoubleClick={handleUserDoubleClick}
                isPrivate={activeRoom.isPrivate}
                isBlocked={isCurrentPeerBlocked}
                onBlockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
                onUnblockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
             />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
             <p className="text-lg">Sohbet başlatmak için bir oda seçiniz.</p>
             <button 
                onClick={() => setUser(null)} // Başa dönmek için logout
                className="mt-4 text-blue-600 hover:underline"
             >
               Oda Seçimine Dön
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;