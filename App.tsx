import React, { useState, useEffect } from 'react';
import JoinScreen from './components/JoinScreen.tsx';
import AiChatModule from './components/ChatInterface.tsx';
import { User, ChatRoom } from './types.ts';
import { signOut } from './services/pocketbase.ts';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [openTabs, setOpenTabs] = useState<ChatRoom[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [blockedBotIds, setBlockedBotIds] = useState<Set<string>>(new Set());

  // Kullanıcı PocketBase ile giriş yapınca tetiklenir
  const handleJoin = (loggedInUser: User, room: ChatRoom) => {
    setUser(loggedInUser);
    
    // Odayı sekmelere ekle
    if (!openTabs.find(t => t.id === room.id)) {
        setOpenTabs([...openTabs, room]);
    }
    setActiveTabId(room.id);
  };

  const handleCloseTab = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== roomId);
    setOpenTabs(newTabs);
    
    if (activeTabId === roomId) {
        if (newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
            setActiveTabId(null);
            // Tüm sekmeler kapandıysa çıkış yapabilir veya oda seçimine dönebiliriz.
            // Şimdilik oturumu açık tutuyoruz ama ekran boş kalmasın diye oda seçimi gibi davranabiliriz.
             setUser(null); // JoinScreen'e geri dön
        }
    }
  };

  const handleLogout = () => {
    signOut();
    setUser(null);
    setOpenTabs([]);
    setActiveTabId(null);
  };

  const handleUserDoubleClick = (targetUser: User) => {
    if (!user || targetUser.id === user.id) return;

    const privateRoomId = `private_${[user.id, targetUser.id].sort().join('_')}`;
    const existingTab = openTabs.find(t => t.id === privateRoomId);

    if (existingTab) {
        setActiveTabId(privateRoomId);
    } else {
        const privateRoom: ChatRoom = {
            id: privateRoomId,
            name: targetUser.name,
            topic: 'Özel Sohbet',
            description: `${targetUser.name} ile özel sohbet`,
            participants: [targetUser], 
            isPrivate: true
        };
        setOpenTabs([...openTabs, privateRoom]);
        setActiveTabId(privateRoomId);
    }
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

  // Eğer kullanıcı giriş yapmamışsa
  if (!user) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  const activeRoom = openTabs.find(t => t.id === activeTabId);
  const isCurrentPeerBlocked = activeRoom?.isPrivate && activeRoom.participants.length > 0 
    ? blockedBotIds.has(activeRoom.participants[0].id)
    : false;

  return (
    <div className="h-screen w-full bg-[#1a1a1a] flex flex-col font-sans overflow-hidden">
      
      {/* Top Bar (System Status / Branding / Tabs) */}
      <div className="bg-[#0f0f0f] border-b border-gray-800 flex flex-col shrink-0">
          
          {/* Header Row */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#050505] border-b border-gray-900 text-xs">
              <div className="flex items-center gap-2">
                  <div className="text-[#00ff9d] font-bold tracking-widest">WORKIGOM</div>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500">Güvenli Sohbet Ağı</span>
              </div>
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-400">
                      <img src={user.avatar} className="w-4 h-4 rounded-full" />
                      <span className="font-bold text-white">{user.name}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="text-red-500 hover:text-red-400 font-bold uppercase hover:underline"
                  >
                    [Çıkış]
                  </button>
              </div>
          </div>

          {/* Tabs Row */}
          <div className="flex items-end px-2 pt-2 gap-1 overflow-x-auto bg-[#1a1a1a]">
              {openTabs.map(room => (
                  <div 
                    key={room.id}
                    onClick={() => setActiveTabId(room.id)}
                    className={`
                        group flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg cursor-pointer select-none border-t border-l border-r min-w-[120px] max-w-[200px]
                        ${activeTabId === room.id 
                            ? 'bg-[#252525] text-[#00ff9d] border-gray-700 relative z-10' 
                            : 'bg-[#0f0f0f] text-gray-500 border-gray-900 hover:bg-[#151515] hover:text-gray-300'}
                    `}
                  >
                      <span className="truncate flex-1">
                          {room.isPrivate ? '@ ' : '# '}
                          {room.name}
                      </span>
                      <button 
                        onClick={(e) => handleCloseTab(room.id, e)}
                        className="text-gray-600 hover:text-red-500 font-bold p-0.5 rounded-full"
                      >
                          ×
                      </button>
                  </div>
              ))}
              
              {/* Optional: Add Room Button */}
              {/* <button className="px-3 py-2 text-gray-500 hover:text-[#00ff9d] font-bold">+</button> */}
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-[#252525] overflow-hidden border-t border-gray-700">
        {activeRoom ? (
             <AiChatModule 
                key={activeRoom.id} // Re-mount when switching rooms ensures clean state
                currentUser={user}
                topic={activeRoom.topic}
                participants={activeRoom.participants}
                title={activeRoom.name}
                roomId={activeRoom.id}
                onClose={() => handleCloseTab(activeRoom.id, { stopPropagation: () => {} } as any)}
                
                onUserDoubleClick={handleUserDoubleClick}
                isPrivate={activeRoom.isPrivate}
                isBlocked={isCurrentPeerBlocked}
                onBlockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
                onUnblockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
             />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
             <div className="text-4xl mb-4 opacity-20">WORKIGOM</div>
             <p>Açık bir sohbet penceresi yok.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;