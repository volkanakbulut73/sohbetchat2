import React, { useState } from 'react';
import { ROOMS } from '../constants.ts';
import { ChatRoom } from '../types.ts';
import { loginOrRegister } from '../services/pocketbase.ts';

interface JoinScreenProps {
  onJoin: (user: any, room: ChatRoom) => void;
}

const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(ROOMS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHttpFix, setShowHttpFix] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setShowHttpFix(false);

    try {
        const userRecord = await loginOrRegister(name);
        
        const room = ROOMS.find(r => r.id === selectedRoomId);
        if (room && userRecord) {
            // PB user record'unu bizim app user formatına uyarla.
            const avatarUrl = (userRecord.avatar && userRecord.avatar.startsWith('http')) 
                ? userRecord.avatar 
                : `https://picsum.photos/seed/${userRecord.id}/200/200`;

            const appUser = {
                id: userRecord.id,
                name: userRecord.name || userRecord.username,
                avatar: avatarUrl,
                isBot: false
            };
            onJoin(appUser, room);
        }
    } catch (err: any) {
        console.error(err);
        
        // Hata durumunda protokol kontrolü yap
        const isHttps = window.location.protocol === 'https:';
        
        if (isHttps) {
            setError("Sunucuya bağlanılamadı. HTTPS/HTTP çakışması olabilir.");
            setShowHttpFix(true);
        } else {
            setError("Giriş yapılamadı. Sunucu kapalı veya erişilemiyor olabilir.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleSwitchToHttp = () => {
      const httpUrl = window.location.href.replace('https:', 'http:');
      window.location.href = httpUrl;
  };

  const getOnlineCount = (roomId: string) => {
    const hash = roomId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 40) + 12;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Sohbete Katıl</h1>
          <p className="text-gray-500 mt-2">İsminizi seçin ve bir odaya girin.</p>
        </div>

        {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm flex flex-col gap-2">
                <p>{error}</p>
                {showHttpFix && (
                    <button 
                        type="button"
                        onClick={handleSwitchToHttp}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors text-xs w-full"
                    >
                        Sorunu Çöz (HTTP Moduna Geç)
                    </button>
                )}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              id="name"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="Örn: Ahmet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Oda Seçimi
            </label>
            <div className="space-y-3">
              {ROOMS.map((room) => (
                <label
                  key={room.id}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedRoomId === room.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="room"
                    value={room.id}
                    checked={selectedRoomId === room.id}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    disabled={isLoading}
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">
                      {room.name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {room.topic}
                    </span>
                    <div className="mt-1">
                        <span className="text-xs text-indigo-600 font-medium">
                            Şu an odada {getOnlineCount(room.id)} kişi sohbet ediyor
                        </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-500/30 flex items-center justify-center ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Bağlanılıyor...
                </>
            ) : (
                <>
                    Sohbete Başla
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinScreen;