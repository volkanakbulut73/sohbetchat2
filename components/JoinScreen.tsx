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
        setError(err.message || "Giriş işlemi başarısız. Bilgilerinizi kontrol edin.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-[#00ff9d] selection:text-black overflow-y-auto">
      
      {/* Top Bar */}
      <div className="border-b border-gray-800 bg-[#0a0a0a] py-2 px-4 flex justify-between items-center text-[10px] md:text-xs font-mono tracking-widest text-gray-500">
        <span>31.12.2025 00:49</span>
        <span>Workigom Chat | Güvenli Sohbet Platformu</span>
      </div>

      {/* Main Container */}
      <div className="container mx-auto px-4 py-12 md:py-20 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24">
        
        {/* Left Side: Hero & Text */}
        <div className="flex-1 max-w-2xl text-center md:text-left space-y-8">
            <div className="inline-block border border-[#00ff9d]/30 bg-[#00ff9d]/5 text-[#00ff9d] px-4 py-1 rounded text-xs font-mono tracking-wider animate-pulse">
                SİSTEM DURUMU: GÜVENLİ ERİŞİM AKTİF
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight text-white tracking-tight">
                GERÇEK <span className="italic font-serif">İNSANLARLA,</span><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff9d] to-emerald-600 drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
                    GÜVENLİ SOHBET
                </span>
            </h1>

            <div className="flex flex-col md:flex-row items-center gap-4 border-l-4 border-[#00ff9d] pl-6 py-2 bg-gradient-to-r from-[#00ff9d]/5 to-transparent">
                <p className="text-gray-400 text-lg leading-relaxed max-w-lg">
                    Sabıka kaydı temiz, çalışan ve kimliği doğrulanmış kişilerle 
                    huzurlu, seviyeli ve <strong className="text-white">gerçek sohbet ortamı.</strong>
                </p>
            </div>

            {/* Terminal / Visual from Page 4 */}
            <div className="mt-8 rounded-lg overflow-hidden border border-gray-800 bg-[#0a0a0a] font-mono text-xs shadow-2xl max-w-md mx-auto md:mx-0 hidden md:block">
                <div className="bg-gray-800 px-3 py-1 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <span className="ml-2 text-gray-400">status: connected to workigom</span>
                </div>
                <div className="p-4 space-y-2 text-green-500/80">
                    <p>*** Local host: workigomchat.online (127.0.0.1)</p>
                    <p>*** Checking identity protocol...</p>
                    <div className="pl-4 space-y-1 text-[#00ff9d]">
                        <p>✓ Identity verified: [Kimlik Onaylandı]</p>
                        <p>✓ Criminal record: [Sicil Temiz]</p>
                        <p>✓ Professional status: [Aktif Çalışan]</p>
                    </div>
                    <p className="text-purple-400">[ Sistem ]: Sohbete katılmaya yetkiniz var. İyi sohbetler :)</p>
                    <p className="animate-pulse">_</p>
                </div>
            </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full max-w-md bg-[#0f0f0f] border border-gray-800 p-8 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-b from-[#00ff9d] to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            
            <div className="relative bg-[#0f0f0f] rounded-lg h-full flex flex-col">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {isLoginMode ? 'GİRİŞ YAP' : 'BAŞVUR VE KATIL'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {isLoginMode ? 'Hesabınıza erişmek için bilgilerinizi girin.' : 'Ayrıcalıklı dünyaya adım atın.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded mb-4 text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLoginMode && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Ad Soyad / Takma Ad</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-[#00ff9d] text-white px-4 py-3 rounded outline-none transition-colors"
                                placeholder="Sohbette görünecek isim"
                                required={!isLoginMode}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">E-Posta Adresi</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-[#00ff9d] text-white px-4 py-3 rounded outline-none transition-colors"
                            placeholder="ornek@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Şifre</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full bg-[#1a1a1a] border border-gray-800 focus:border-[#00ff9d] text-white px-4 py-3 rounded outline-none transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {/* Room Selection integrated into Login for flow simplicity */}
                    <div>
                         <label className="block text-xs font-bold text-gray-500 mb-2 ml-1 uppercase">Giriş Yapılacak Oda</label>
                         <div className="grid grid-cols-1 gap-2">
                            {ROOMS.map(room => (
                                <label key={room.id} className={`flex items-center p-3 rounded border cursor-pointer transition-all ${selectedRoomId === room.id ? 'border-[#00ff9d] bg-[#00ff9d]/10' : 'border-gray-800 bg-[#1a1a1a] hover:bg-gray-800'}`}>
                                    <input 
                                        type="radio" 
                                        name="room" 
                                        value={room.id}
                                        checked={selectedRoomId === room.id}
                                        onChange={(e) => setSelectedRoomId(e.target.value)}
                                        className="accent-[#00ff9d]"
                                    />
                                    <span className={`ml-3 text-sm ${selectedRoomId === room.id ? 'text-[#00ff9d]' : 'text-gray-400'}`}>{room.name}</span>
                                </label>
                            ))}
                         </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className={`w-full py-4 mt-4 font-bold tracking-widest text-black uppercase transition-all transform hover:-translate-y-1 ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#00ff9d] hover:shadow-[0_0_20px_#00ff9d]'}`}
                    >
                        {isLoading ? 'İŞLENİYOR...' : (isLoginMode ? 'SİSTEME GİRİŞ YAP ->' : 'KAYDI TAMAMLA ->')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => { setIsLoginMode(!isLoginMode); setError(null); }}
                        className="text-gray-500 hover:text-white text-sm underline decoration-gray-700 underline-offset-4 transition-colors"
                    >
                        {isLoginMode ? 'Hesabın yok mu? Başvur ve Katıl' : 'Zaten üye misin? Giriş Yap'}
                    </button>
                </div>
            </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-900 bg-[#050505] py-8 text-center text-gray-600 text-xs">
            <div className="mb-4 text-[#00ff9d] font-bold tracking-[0.5em] opacity-50">WORKIGOM</div>
            <p>WORKIGOM NETWORK SYSTEM © 2025</p>
            <div className="mt-4 flex justify-center gap-6">
                <span className="hover:text-white cursor-pointer">YÖNETİCİ GİRİŞİ</span>
                <span className="hover:text-white cursor-pointer">DESTEK</span>
                <span className="hover:text-white cursor-pointer">KVKK</span>
            </div>
      </footer>
    </div>
  );
};

export default JoinScreen;