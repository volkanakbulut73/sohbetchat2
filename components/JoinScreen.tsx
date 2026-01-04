import React, { useState } from 'react';
import { ROOMS } from '../constants.ts';
import { ChatRoom } from '../types.ts';
import { login, register } from '../services/pocketbase.ts';

interface JoinScreenProps {
  onJoin: (user: any, room: ChatRoom) => void;
}

const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  // Auth State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Only for register
  
  // App State
  const [selectedRoomId, setSelectedRoomId] = useState(ROOMS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
        let userRecord;
        if (isLoginMode) {
            userRecord = await login(email, password);
        } else {
            if (!name) throw new Error("İsim alanı zorunludur.");
            userRecord = await register(email, password, name);
        }

        const room = ROOMS.find(r => r.id === selectedRoomId);
        if (room && userRecord) {
             const avatarUrl = (userRecord.avatar && userRecord.avatar.startsWith('http')) 
                ? userRecord.avatar 
                : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userRecord.id}&backgroundColor=b6e3f4`;

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
        setError(err.message || "Giriş işlemi başarısız. Bilgilerinizi kontrol edin.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4 font-sans text-slate-700">
      
      <div className="max-w-4xl w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row shadow-indigo-100/50 border border-white/50">
        
        {/* Left Side: Welcome Art */}
        <div className="bg-[#6366f1] w-full md:w-1/2 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            {/* Abstract Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/30 rounded-full blur-2xl -ml-10 -mb-10"></div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center transform rotate-3">
                        <span className="text-indigo-600 font-extrabold text-xl">W</span>
                    </div>
                    <span className="font-bold text-lg tracking-wide opacity-90">WORKIGOM</span>
                </div>
                
                <h1 className="text-4xl font-extrabold leading-tight mb-4 tracking-tight">
                    Sohbete<br/>Hoş Geldin!
                </h1>
                <p className="text-indigo-100 text-lg font-medium leading-relaxed opacity-90">
                    Botlarla ve arkadaşlarınla konuşabileceğin en tatlı sohbet platformu.
                </p>
            </div>

            <div className="relative z-10 mt-12 space-y-4">
                <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-transform hover:scale-105">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-md">🤖</div>
                    <div>
                        <p className="font-bold text-white">Akıllı Asistanlar</p>
                        <p className="text-xs text-indigo-100 opacity-80">Sadece ismini söylediğinde cevap verir.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-transform hover:scale-105">
                     <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-md">💬</div>
                    <div>
                        <p className="font-bold text-white">Renkli Odalar</p>
                        <p className="text-xs text-indigo-100 opacity-80">İlgi alanına göre odanı seç.</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 bg-white">
            <h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">
                {isLoginMode ? 'Tekrar Merhaba! 👋' : 'Aramıza Katıl 🚀'}
            </h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">
                {isLoginMode ? 'Giriş yaparak sohbete kaldığın yerden devam et.' : 'Hızlıca hesap oluştur ve sohbete başla.'}
            </p>

            {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-2xl mb-6 text-sm font-medium border border-red-100 flex items-center gap-2">
                    <span>⚠️</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {!isLoginMode && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">İsim</label>
                        <input 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all text-sm font-semibold text-slate-700"
                            placeholder="Sohbetteki Adın"
                            required={!isLoginMode}
                        />
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">E-Posta</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all text-sm font-semibold text-slate-700"
                        placeholder="mail@ornek.com"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">Şifre</label>
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)} 
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all text-sm font-semibold text-slate-700"
                        placeholder="••••••••"
                        required
                    />
                </div>

                <div className="pt-2">
                     <label className="text-xs font-bold text-slate-400 ml-1 block mb-3 uppercase tracking-wider">Oda Seçimi</label>
                     <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {ROOMS.map(room => (
                            <label 
                                key={room.id} 
                                className={`
                                    flex-shrink-0 cursor-pointer px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all
                                    ${selectedRoomId === room.id 
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' 
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}
                                `}
                            >
                                <input 
                                    type="radio" 
                                    name="room" 
                                    value={room.id}
                                    checked={selectedRoomId === room.id}
                                    onChange={(e) => setSelectedRoomId(e.target.value)}
                                    className="hidden"
                                />
                                {room.name}
                            </label>
                        ))}
                     </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl shadow-indigo-200 transition-all transform active:scale-[0.98] ${isLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300'}`}
                >
                    {isLoading ? 'Lütfen Bekleyin...' : (isLoginMode ? 'Giriş Yap' : 'Kayıt Ol')}
                </button>
            </form>

            <div className="mt-8 text-center">
                <button 
                    onClick={() => { setIsLoginMode(!isLoginMode); setError(null); }}
                    className="text-indigo-600 font-bold text-sm hover:text-indigo-800 transition-colors"
                >
                    {isLoginMode ? 'Hesabın yok mu? Kaydol' : 'Zaten üye misin? Giriş Yap'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default JoinScreen;