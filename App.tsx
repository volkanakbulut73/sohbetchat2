import React, { useState, useEffect } from 'react';
import JoinScreen from './components/JoinScreen.tsx';
import AiChatModule from './components/ChatInterface.tsx';
import { User, ChatRoom } from './types.ts';
import { signOut } from './services/pocketbase.ts';

/**
 * Bu "App" bileşeni, AiChatModule'ü entegre eden ana uygulamayı temsil eder.
 */
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [blockedBotIds, setBlockedBotIds] = useState<Set<string>>(new Set());
  const [protocolError, setProtocolError] = useState<boolean>(false);

  useEffect(() => {
    // Mixed Content Kontrolü
    // Eğer sayfa HTTPS ise ama PocketBase HTTP ise tarayıcı bloklar.
    if (window.location.protocol === 'https:') {
        // PocketBase URL'imiz http://72.62.178.90:8090 olduğu için uyarı vermeliyiz.
        // Gerçek PB URL'ini services/pocketbase.ts'den alamadığımız durumlar için buraya manuel kontrol koyuyoruz.
        const pbIsHttp = true; // IP adresi olduğu için HTTP.
        if (pbIsHttp) {
            setProtocolError(true);
        }
    }
  }, []);

  // Kullanıcı PocketBase ile giriş yapınca tetiklenir
  const handleJoin = (loggedInUser: User, room: ChatRoom) => {
    setUser(loggedInUser);
    setActiveRoom(room);
  };

  const handleCloseModule = () => {
    setActiveRoom(null);
  };

  const handleLogout = () => {
    signOut(); // PocketBase oturumunu temizle
    setUser(null);
    setActiveRoom(null);
  };

  const handleUserDoubleClick = (targetUser: User) => {
    if (!user || targetUser.id === user.id) return;

    const privateRoomId = `private_${[user.id, targetUser.id].sort().join('_')}`;
    
    const privateRoom: ChatRoom = {
        id: privateRoomId,
        name: targetUser.name,
        topic: 'Özel Sohbet',
        description: `${targetUser.name} ile özel sohbet`,
        participants: [targetUser], 
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

  if (protocolError) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-lg text-center bg-gray-800 p-8 rounded-xl shadow-2xl border border-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-2xl font-bold mb-4">Güvenlik Bağlantısı Hatası</h1>
                <p className="text-gray-300 mb-6">
                    Bu uygulama şu anda <strong>HTTPS</strong> (Güvenli) üzerinden çalışıyor ancak veritabanı sunucusu <strong>HTTP</strong> (72.62.178.90) kullanıyor.
                </p>
                <div className="bg-black/30 p-4 rounded text-left text-sm text-gray-400 mb-6">
                    Modern tarayıcılar, güvenli sayfalardan (https) güvensiz sunuculara (http) bağlanmayı engeller (Mixed Content Block).
                </div>
                <h3 className="font-bold text-lg mb-2">Çözüm:</h3>
                <p className="mb-6">
                    Lütfen tarayıcınızın adres çubuğundaki <code className="bg-gray-700 px-1 rounded">https://</code> kısmını <code className="bg-green-600 text-white px-1 rounded">http://</code> yaparak sayfayı yeniden yükleyin.
                </p>
                <a 
                   href={window.location.href.replace('https:', 'http:')}
                   className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    HTTP Sürümüne Git
                </a>
            </div>
        </div>
    );
  }

  // Eğer kullanıcı giriş yapmamışsa (login ekranı)
  if (!user) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  const isCurrentPeerBlocked = activeRoom?.isPrivate && activeRoom.participants.length > 0 
    ? blockedBotIds.has(activeRoom.participants[0].id)
    : false;

  return (
    <div className="h-screen w-full bg-slate-200 flex flex-col md:flex-row">
      
      {/* Sol Sidebar */}
      <div className="w-full md:w-64 bg-slate-800 text-white p-6 hidden md:block">
        <h1 className="text-2xl font-bold mb-8">Ana Uygulama</h1>
        <div className="flex items-center gap-3 mb-8 bg-slate-700 p-3 rounded-lg">
           <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
           <div className="overflow-hidden">
              <div className="font-bold text-sm truncate">{user.name}</div>
              <div className="text-xs text-slate-400">Online</div>
           </div>
        </div>
        <nav className="space-y-4">
          <div className="block p-2 bg-slate-700 rounded cursor-pointer">Panel</div>
          <button 
            onClick={handleLogout}
            className="w-full text-left block p-2 hover:bg-slate-700 rounded cursor-pointer text-red-400"
          >
            Çıkış Yap
          </button>
        </nav>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden relative">
        
        {/* Eğer bir oda seçiliyse Modülü Göster, değilse Placeholder göster */}
        {activeRoom ? (
          <div className="w-full max-w-4xl mx-auto h-full shadow-2xl rounded-xl overflow-hidden">
             <AiChatModule 
                currentUser={user}
                topic={activeRoom.topic}
                participants={activeRoom.participants}
                title={activeRoom.name}
                roomId={activeRoom.id} // DB için unique room ID
                onClose={handleCloseModule}
                height="h-full"
                
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
                onClick={handleLogout} 
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