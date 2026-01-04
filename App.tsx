import React, { useState, useEffect } from 'react';
import JoinScreen from './components/JoinScreen.tsx';
import AiChatModule from './components/ChatInterface.tsx';
import { User, ChatRoom } from './types.ts';
import { ROOMS } from './constants.ts';
import { signOut } from './services/pocketbase.ts';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [openTabs, setOpenTabs] = useState<ChatRoom[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [blockedBotIds, setBlockedBotIds] = useState<Set<string>>(new Set());
  const [showChannelList, setShowChannelList] = useState(false);

  // Kullanıcı PocketBase ile giriş yapınca tetiklenir
  const handleJoin = (loggedInUser: User, room: ChatRoom) => {
    setUser(loggedInUser);
    
    // İlk girişte seçilen odayı aç
    if (!openTabs.find(t => t.id === room.id)) {
        setOpenTabs([...openTabs, room]);
    }
    setActiveTabId(room.id);
  };

  const handleOpenRoom = (room: ChatRoom) => {
    if (!openTabs.find(t => t.id === room.id)) {
        setOpenTabs([...openTabs, room]);
    }
    setActiveTabId(room.id);
    setShowChannelList(false);
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
              <div className="flex items-center gap-4">
                  <div className="text-[#00ff9d] font-bold tracking-widest">WORKIGOM</div>
                  
                  {/* Channel List Button */}
                  <div className="relative">
                      <button 
                        onClick={() => setShowChannelList(!showChannelList)}
                        className="flex items-center gap-1 text-gray-300 hover:text-white bg-gray-900 px-2 py-1 rounded border border-gray-700"
                      >
                          <span># Kanallar</span>
                          <span className="text-[10px]">▼</span>
                      </button>
                      
                      {showChannelList && (
                          <div className="absolute top-full left-0 mt-1 w-48 bg-[#1f1f1f] border border-gray-700 rounded shadow-xl z-50 py-1">
                              {ROOMS.map(r => (
                                  <button
                                    key={r.id}
                                    onClick={() => handleOpenRoom(r)}
                                    className="w-full text-left px-3 py-2 text-gray-400 hover:bg-[#252525] hover:text-[#00ff9d] text-xs"
                                  >
                                      # {r.name}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
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
          <div className="flex items-end px-2 pt-2 gap-1 overflow-x-auto bg-[#1a1a1a] scrollbar-thin">
              {openTabs.map(room => (
                  <div 
                    key={room.id}
                    onClick={() => setActiveTabId(room.id)}
                    className={`
                        group flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium rounded-t-lg cursor-pointer select-none border-t border-l border-r min-w-[100px] max-w-[180px]
                        ${activeTabId === room.id 
                            ? 'bg-[#252525] text-[#00ff9d] border-gray-700 relative z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]' 
                            : 'bg-[#0f0f0f] text-gray-500 border-gray-900 hover:bg-[#151515] hover:text-gray-300'}
                    `}
                  >
                      <span className="truncate flex-1">
                          {room.isPrivate ? '@ ' : '# '}
                          {room.name}
                      </span>
                      <button 
                        onClick={(e) => handleCloseTab(room.id, e)}
                        className="text-gray-600 hover:text-red-500 font-bold p-0.5 rounded-full hover:bg-white/10 w-4 h-4 flex items-center justify-center"
                      >
                          ×
                      </button>
                  </div>
              ))}
              
              {openTabs.length === 0 && (
                  <div className="text-xs text-gray-600 px-4 py-2 italic">Açık kanal yok. Yukarıdan seçin.</div>
              )}
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
          <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-[#252525]">
             <div className="text-4xl mb-4 opacity-10 font-black tracking-tighter">WORKIGOM</div>
             <p className="text-sm">Sohbete başlamak için üst menüden bir kanal seçin.</p>
             <button 
                onClick={() => setShowChannelList(true)}
                className="mt-4 px-4 py-2 bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/30 rounded hover:bg-[#00ff9d]/20 transition-colors"
             >
                 Kanal Listesini Aç
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;