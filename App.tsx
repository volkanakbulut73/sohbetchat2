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

  const handleJoin = (loggedInUser: User, room: ChatRoom) => {
    setUser(loggedInUser);
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
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
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

  if (!user) return <JoinScreen onJoin={handleJoin} />;

  const activeRoom = openTabs.find(t => t.id === activeTabId);

  return (
    <div className="h-screen w-full bg-white flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-100 flex items-center justify-between px-4 py-2 shrink-0 z-50">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 mr-4">
                 <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center text-white font-bold text-sm">W</div>
                 <span className="text-slate-800 font-extrabold text-sm tracking-tight">WORKIGOM</span>
              </div>
              
              <div className="relative">
                  <button 
                    onClick={() => setShowChannelList(!showChannelList)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] hover:bg-gray-200 text-slate-700 rounded-xl transition-all font-bold text-xs"
                  >
                      <span>📂 Odalar</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                  </button>

                  {showChannelList && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[100]">
                          {ROOMS.map(room => (
                              <button key={room.id} onClick={() => handleOpenRoom(room)} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 transition-colors">
                                  <span className="text-blue-500 font-bold">#</span>
                                  <span className="text-sm font-bold text-slate-700">{room.name}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 ml-4 border-l border-gray-100 pl-4 overflow-x-auto scrollbar-hide">
                  {openTabs.map(tab => {
                      const isActive = activeTabId === tab.id;
                      return (
                          <div 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`
                                group flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all border
                                ${isActive 
                                    ? 'bg-white border-blue-500 text-blue-600 shadow-sm' 
                                    : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'}
                            `}
                          >
                              <span className="text-xs font-bold truncate"># {tab.name}</span>
                              <button onClick={(e) => handleCloseTab(tab.id, e)} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                              </button>
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-1.5 rounded-full">
                  <img src={user.avatar} className="w-7 h-7 rounded-full border border-white" />
                  <div className="pr-1 text-right">
                      <p className="text-[11px] font-bold text-slate-700 leading-tight">{user.name}</p>
                      <p className="text-[9px] text-green-500 font-bold leading-tight">● Çevrimiçi</p>
                  </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-white h-full overflow-hidden">
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
             />
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                 <div className="text-6xl mb-4">✨</div>
                 <h2 className="text-xl font-bold text-slate-400">Sohbet Seçilmedi</h2>
             </div>
          )}
      </div>
    </div>
  );
}

export default App;