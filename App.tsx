import React, { useState, useEffect } from 'react';
import JoinScreen from './components/JoinScreen.tsx';
import AiChatModule from './components/ChatInterface.tsx';
import { User, ChatRoom } from './types.ts';
import { ROOMS } from './constants.ts';
import { pb, signOut } from './services/pocketbase.ts';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [openTabs, setOpenTabs] = useState<ChatRoom[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showChannelList, setShowChannelList] = useState(false);
  const [unreadRoomIds, setUnreadRoomIds] = useState<Set<string>>(new Set());

  // Global Realtime Subscription for incoming messages
  useEffect(() => {
    if (!user) return;

    // Subscribe to all messages to catch private ones
    const unsubscribe = pb.collection('messages').subscribe('*', (e) => {
      if (e.action === 'create') {
        const msg = e.record;
        
        // Check if it's a private message for ME (room ID contains my ID and is private)
        if (msg.room.startsWith('private_') && msg.room.includes(user.id)) {
          // If I am NOT the sender
          if (msg.senderId !== user.id) {
            
            setOpenTabs(prev => {
              const tabExists = prev.find(t => t.id === msg.room);
              if (!tabExists) {
                // Automatically create the tab for the recipient
                const newPrivateRoom: ChatRoom = {
                  id: msg.room,
                  name: msg.senderName, // Name is the sender's name
                  topic: 'Özel Sohbet',
                  description: `${msg.senderName} ile özel sohbet`,
                  participants: [{
                    id: msg.senderId,
                    name: msg.senderName,
                    avatar: msg.senderAvatar,
                    isBot: false
                  }], 
                  isPrivate: true
                };
                return [...prev, newPrivateRoom];
              }
              return prev;
            });

            // If the room is not currently active, mark as unread (flash red)
            if (activeTabId !== msg.room) {
              setUnreadRoomIds(prev => new Set(prev).add(msg.room));
            }
          }
        }
      }
    });

    return () => {
      pb.collection('messages').unsubscribe('*');
    };
  }, [user, activeTabId]);

  // Clear unread status when switching tabs
  useEffect(() => {
    if (activeTabId && unreadRoomIds.has(activeTabId)) {
      setUnreadRoomIds(prev => {
        const next = new Set(prev);
        next.delete(activeTabId);
        return next;
      });
    }
  }, [activeTabId]);

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
    setUnreadRoomIds(prev => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
    });
  };

  const handleLogout = () => {
    signOut();
    setUser(null);
    setOpenTabs([]);
    setActiveTabId(null);
    setUnreadRoomIds(new Set());
  };

  const handleUserDoubleClick = (targetUser: User) => {
    if (!user || targetUser.id === user.id) return;
    // Common private room ID pattern
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
    <div className="h-[100dvh] w-full bg-white flex flex-col font-sans overflow-hidden fixed inset-0">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-100 flex items-center justify-between px-3 md:px-4 py-2 shrink-0 z-50 min-h-[75px]">
          <div className="flex items-center gap-3 md:gap-4 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                 <div className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center text-white font-bold text-sm">W</div>
                 <span className="text-slate-800 font-extrabold text-sm tracking-tight hidden lg:block uppercase">Workigom</span>
              </div>
              
              <div className="relative shrink-0">
                  <button 
                    onClick={() => setShowChannelList(!showChannelList)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] hover:bg-gray-200 text-slate-700 rounded-xl transition-all font-bold text-xs"
                  >
                      <span>📂 <span className="hidden sm:inline">Odalar</span></span>
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
              <div className="flex items-center gap-2 md:gap-4 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1 border-l border-gray-100 pl-2 md:pl-4 overflow-x-auto scrollbar-hide">
                      {openTabs.map(tab => {
                          const isActive = activeTabId === tab.id;
                          const hasUnread = unreadRoomIds.has(tab.id);

                          return (
                              <div 
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                className={`
                                    group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all border shrink-0 relative
                                    ${isActive 
                                        ? 'bg-white border-blue-500 text-blue-600 shadow-sm' 
                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'}
                                `}
                              >
                                  {hasUnread && (
                                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                      </span>
                                  )}
                                  
                                  <span className={`text-xs font-bold truncate ${hasUnread ? 'animate-flash-red' : ''}`}>
                                      {tab.isPrivate ? '👤' : '#'} {tab.name}
                                  </span>

                                  <button onClick={(e) => handleCloseTab(tab.id, e)} className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                                  </button>
                              </div>
                          );
                      })}
                  </div>

                  {/* Radio Player */}
                  <div className="hidden lg:flex items-center justify-center border-l border-gray-100 pl-4 overflow-hidden shrink-0">
                    <div className="bg-[#f0f2f5] rounded-xl p-1 shadow-sm border border-gray-100 overflow-hidden flex items-center">
                      <iframe 
                        width="345" 
                        height="65" 
                        src="https://www.radyod.com/iframe-small" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                        className="rounded-lg scale-[0.85] origin-center"
                        title="Radyo D Player"
                      ></iframe>
                    </div>
                  </div>
              </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2">
              <div className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-1 md:px-3 md:py-1.5 rounded-full">
                  <img src={user.avatar} className="w-6 h-6 md:w-7 md:h-7 rounded-full border border-white" />
                  <div className="pr-1 text-right hidden sm:block">
                      <p className="text-[10px] md:text-[11px] font-bold text-slate-700 leading-tight truncate max-w-[80px]">{user.name}</p>
                      <p className="text-[8px] md:text-[9px] text-green-500 font-bold leading-tight">● Çevrimiçi</p>
                  </div>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-white overflow-hidden h-full">
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