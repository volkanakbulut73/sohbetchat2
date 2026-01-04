import React, { useState } from 'react';
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
    <div className="h-screen w-full bg-slate-50 flex flex-col font-sans overflow-hidden">
      
      {/* Top Bar (System Status / Branding / Tabs) */}
      <div className="bg-white border-b border-gray-100 flex flex-col shrink-0 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] z-50">
          
          {/* Header Row */}
          <div className="flex items-center justify-between px-6 py-3 bg-white">
              <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center text-white font-extrabold text-lg transform rotate-3">W</div>
                     <span className="text-slate-800 font-extrabold tracking-tight hidden md:block text-lg">WORKIGOM</span>
                  </div>
                  
                  {/* Channel List Button */}
                  <div className="relative">
                      <button 
                        onClick={() => setShowChannelList(!showChannelList)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all border border-slate-100 font-bold text-sm"
                      >
                          <span className="text-lg">📂</span>
                          <span>Odalar</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showChannelList ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>

                      {/* Channel Dropdown */}
                      {showChannelList && (
                          <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl shadow-indigo-100 border border-gray-100 overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                              <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Mevcut Odalar</div>
                              {ROOMS.map(room => (
                                  <button
                                      key={room.id}
                                      onClick={() => handleOpenRoom(room)}
                                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
                                  >
                                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                          #
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-700">{room.name}</div>
                                          <div className="text-xs text-slate-400 truncate w-48">{room.topic}</div>
                                      </div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Right Side: User Profile */}
              <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                      <img src={user.avatar} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white shadow-sm" alt="Profile" />
                      <div className="pr-2">
                          <p className="text-xs font-bold text-slate-700">{user.name}</p>
                          <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-[10px] text-slate-400 font-medium">Çevrimiçi</span>
                          </div>
                      </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Çıkış Yap"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
              </div>
          </div>

          {/* Tabs Bar */}
          <div className="flex items-center px-4 pt-2 gap-2 overflow-x-auto scrollbar-hide bg-slate-50/50 backdrop-blur-sm border-t border-gray-100">
              {openTabs.map(tab => {
                  const isActive = activeTabId === tab.id;
                  return (
                      <div 
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`
                            group relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl cursor-pointer select-none transition-all min-w-[140px] max-w-[200px] border-b-2
                            ${isActive 
                                ? 'bg-white text-indigo-600 border-indigo-600 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]' 
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-white/60 hover:text-slate-700'}
                        `}
                      >
                          <span className="text-lg">{tab.isPrivate ? '🔒' : '#'}</span>
                          <span className="font-bold text-xs truncate flex-1">{tab.name}</span>
                          
                          <button 
                            onClick={(e) => handleCloseTab(tab.id, e)}
                            className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'hover:bg-indigo-50 text-indigo-400' : 'hover:bg-slate-200 text-slate-400'}`}
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                      </div>
                  );
              })}
              {openTabs.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 font-medium italic">
                    Başlamak için sol üstten bir oda seçin... 👆
                </div>
              )}
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-white h-full overflow-hidden flex flex-col">
          {activeRoom ? (
             <AiChatModule 
                key={activeRoom.id}
                currentUser={user}
                topic={activeRoom.topic}
                participants={activeRoom.participants}
                title={activeRoom.name}
                roomId={activeRoom.id}
                isPrivate={activeRoom.isPrivate}
                onUserDoubleClick={handleUserDoubleClick}
                isBlocked={isCurrentPeerBlocked}
                onBlockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
                onUnblockUser={() => activeRoom.participants[0] && toggleBlock(activeRoom.participants[0].id)}
             />
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 bg-slate-50">
                 <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 animate-pulse">
                    <span className="text-6xl">✨</span>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-400 mb-2">Sohbet Seçilmedi</h2>
                 <p className="text-slate-400 max-w-xs text-center">Sol üst köşedeki "Odalar" menüsünden bir oda seç veya arkadaşlarına çift tıkla.</p>
             </div>
          )}
      </div>
    </div>
  );
}

export default App;