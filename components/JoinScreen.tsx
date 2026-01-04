import React, { useState } from 'react';
import { ROOMS } from '../constants.ts';
import { ChatRoom } from '../types.ts';
import { login, register } from '../services/pocketbase.ts';

interface JoinScreenProps {
  onJoin: (user: any, room: ChatRoom) => void;
}

const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin }) => {
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
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
        setError(err.message || "İşlem başarısız.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0a0c] min-h-screen text-white selection:bg-[#00ff9d] selection:text-black">
      
      {/* PAGE 1: HERO SECTION */}
      <section className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00ff9d]/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]"></div>

          <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
              <div className="inline-flex items-center gap-2 border border-[#00ff9d]/30 bg-[#00ff9d]/5 px-4 py-2 rounded-lg mb-12">
                  <span className="w-2 h-2 bg-[#00ff9d] rounded-full animate-pulse"></span>
                  <span className="text-[10px] md:text-[12px] font-bold tracking-widest text-[#00ff9d] uppercase">SİSTEM DURUMU: GÜVENLİ ERİŞİM AKTİF</span>
              </div>

              <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter leading-tight mb-8">
                  GERÇEK İNSANLARLA, <br/>
                  <span className="text-[#00ff9d] neon-glow">GÜVENLİ SOHBET</span>
              </h1>

              <div className="flex gap-4 max-w-2xl mx-auto mb-16 text-left border-l-2 border-[#00ff9d] pl-6 py-2">
                  <p className="text-gray-400 text-lg md:text-xl font-medium leading-relaxed">
                      Sabıka kaydı temiz, çalışan ve kimliği doğrulanmış kişilerle <br/>
                      <span className="text-white">huzurlu, seviyeli ve gerçek sohbet ortamı.</span>
                  </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
                  <button 
                    onClick={() => setShowAuthModal(true)}
                    className="flex-1 bg-[#00ff9d] text-black font-black py-5 rounded-lg flex items-center justify-center gap-3 hover:bg-[#05e58d] transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,255,157,0.3)]"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      GİRİŞ YAP
                  </button>
                  <button 
                    onClick={() => { setIsLoginMode(false); setShowAuthModal(true); }}
                    className="flex-1 border-2 border-[#00ff9d] text-[#00ff9d] font-black py-5 rounded-lg flex items-center justify-center gap-3 hover:bg-[#00ff9d]/5 transition-all"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      BAŞVUR VE KATIL
                  </button>
              </div>
          </div>
      </section>

      {/* PAGE 2 & 3: SECURITY FEATURES */}
      <section className="py-32 px-6 bg-[#0c0c0e]">
          <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-4 mb-20 justify-center md:justify-start">
                  <div className="w-12 h-12 bg-[#00ff9d]/10 border border-[#00ff9d]/20 rounded-xl flex items-center justify-center text-[#00ff9d] text-2xl">🛡️</div>
                  <h2 className="text-3xl md:text-5xl font-black italic tracking-tight uppercase">GÜVENLİK BİZİM ÖNCELİĞİMİZ</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                  {/* Card 1 */}
                  <div className="bg-[#111114] border border-white/5 p-10 rounded-2xl relative group hover:border-[#00ff9d]/30 transition-all">
                      <div className="w-14 h-14 bg-[#00ff9d]/5 rounded-xl flex items-center justify-center text-[#00ff9d] text-3xl mb-8 group-hover:scale-110 transition-transform">👥</div>
                      <h3 className="text-xl font-black mb-6 uppercase tracking-wider">GERÇEK KİŞİLER</h3>
                      <ul className="space-y-4">
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Kimlik doğrulama zorunlu
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Sahte hesaplara geçit yok
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Aktif moderasyon ve denetim
                          </li>
                      </ul>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-[#111114] border border-white/5 p-10 rounded-2xl relative group hover:border-[#00ff9d]/30 transition-all">
                      <div className="w-14 h-14 bg-[#00ff9d]/5 rounded-xl flex items-center justify-center text-[#00ff9d] text-3xl mb-8 group-hover:scale-110 transition-transform">📄</div>
                      <h3 className="text-xl font-black mb-6 uppercase tracking-wider">SABIKA KAYDI KONTROLÜ</h3>
                      <ul className="space-y-4">
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Temiz sicil olmayan kabul edilmez
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Topluluk güvenliği esastır
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Düzenli periyodik denetimler
                          </li>
                      </ul>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-[#111114] border border-white/5 p-10 rounded-2xl relative group hover:border-[#00ff9d]/30 transition-all">
                      <div className="w-14 h-14 bg-[#00ff9d]/5 rounded-xl flex items-center justify-center text-[#00ff9d] text-3xl mb-8 group-hover:scale-110 transition-transform">💼</div>
                      <h3 className="text-xl font-black mb-6 uppercase tracking-wider">ÇALIŞAN OLMA ZORUNLULUĞU</h3>
                      <ul className="space-y-4">
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Aktif çalışan bireyler
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Daha saygılı ve bilinçli topluluk
                          </li>
                          <li className="flex items-center gap-3 text-gray-400 text-sm">
                              <span className="text-[#00ff9d]">✔</span> Profesyonel sosyal ağ
                          </li>
                      </ul>
                  </div>
              </div>
          </div>
      </section>

      {/* PAGE 4: WHY US & TERMINAL */}
      <section className="py-32 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
              <div>
                  <h2 className="text-4xl md:text-6xl font-black italic mb-8 uppercase">NEDEN BURADAYIZ?</h2>
                  <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-12">
                      İnternette anonimlik çoğu zaman güvensizliği beraberinde getirir. <span className="text-[#00ff9d]">Biz bu döngüyü kırmak için buradayız.</span>
                  </p>
                  
                  <div className="bg-[#111114] border-l-4 border-[#00ff9d] p-8 mb-12">
                       <p className="text-white text-lg font-medium italic">
                          "Amacımız; gerçek insanların, gerçek sohbetler yaptığı, seviyeli, güvenli ve saygılı bir ortam oluşturmak."
                       </p>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                          <span className="text-[#00ff9d] font-black tracking-widest text-xs uppercase">SOHBET KÜLTÜRÜMÜZ</span>
                          <p className="text-gray-400 text-sm">"Naber millet?" samimiyeti</p>
                      </div>
                      <div className="flex flex-col gap-2">
                          <span className="text-[#00ff9d] font-black tracking-widest text-xs uppercase">MODERASYON</span>
                          <p className="text-gray-400 text-sm">7/24 Aktif ve Tarafsız</p>
                      </div>
                  </div>
              </div>

              {/* TERMINAL UI */}
              <div className="relative group">
                  <div className="absolute inset-0 bg-[#00ff9d]/5 blur-3xl rounded-full"></div>
                  <div className="bg-[#111114] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative z-10 font-mono text-xs md:text-sm">
                      <div className="bg-[#1a1a1e] px-4 py-3 flex items-center justify-between border-b border-white/5">
                          <div className="flex gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                          </div>
                          <div className="text-gray-500 text-[10px] tracking-widest uppercase">Status: connected to Workigom (irc.workigomchat.online)</div>
                          <div className="w-12"></div>
                      </div>
                      <div className="p-6 space-y-4 min-h-[300px] text-gray-300">
                          <div className="flex gap-4">
                              <span className="text-blue-400">***</span>
                              <span>Local host: workigomchat.online (127.0.0.1)</span>
                          </div>
                          <div className="flex gap-4">
                              <span className="text-blue-400">***</span>
                              <span>Checking identity protocol...</span>
                          </div>
                          <div className="space-y-2 pl-8">
                              <div className="flex items-center gap-3">
                                  <span className="w-4 h-4 rounded-full border border-[#00ff9d] flex items-center justify-center text-[8px] text-[#00ff9d]">✔</span>
                                  <span>Identity verified: <span className="text-[#00ff9d]">[Kimlik Onaylandı]</span></span>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className="w-4 h-4 rounded-full border border-[#00ff9d] flex items-center justify-center text-[8px] text-[#00ff9d]">✔</span>
                                  <span>Criminal record: <span className="text-[#00ff9d]">[Sicil Temiz]</span></span>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className="w-4 h-4 rounded-full border border-[#00ff9d] flex items-center justify-center text-[8px] text-[#00ff9d]">✔</span>
                                  <span>Professional status: <span className="text-[#00ff9d]">[Aktif Çalışan]</span></span>
                              </div>
                          </div>
                          <div className="flex gap-4 pt-4">
                              <span className="text-purple-400">[ Sistem ]:</span>
                              <span>Sohbete katılmaya yetkiniz var. İyi sohbetler 😊</span>
                          </div>
                          <div className="flex gap-4">
                              <span>Kanal girişi bekleniyor...</span>
                              <span className="w-2 h-4 bg-[#00ff9d] animate-pulse"></span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* PAGE 5: FINAL CTA */}
      <section className="py-40 px-6 text-center bg-gradient-to-b from-transparent to-[#00ff9d]/5 relative">
          <div className="max-w-4xl mx-auto relative z-10">
              <h2 className="text-4xl md:text-7xl font-black italic mb-10 tracking-tighter uppercase">
                  GÜVENLİ SOHBET BİR <br/>
                  <span className="text-[#00ff9d]">AYRICALIKTIR</span>
              </h2>
              <div className="text-xs tracking-[0.5em] text-gray-500 font-bold mb-16 uppercase">W O R K I G O M C H A T . O N L I N E</div>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <button onClick={() => { setIsLoginMode(false); setShowAuthModal(true); }} className="px-10 py-5 bg-[#00ff9d] text-black font-black rounded-lg hover:scale-105 transition-all shadow-lg shadow-[#00ff9d]/20 uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                      <span>🔐</span> BAŞVUR VE KATIL
                  </button>
                  <button className="px-10 py-5 border border-white/10 text-gray-400 font-bold rounded-lg hover:bg-white/5 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                      <span>📄</span> KURALLAR & GİZLİLİK
                  </button>
              </div>
          </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-white/5 bg-[#08080a]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-[10px] tracking-[0.3em] font-bold text-gray-600 uppercase">
                  W O R K I G O M &nbsp; N E T W O R K &nbsp; S Y S T E M &nbsp; © &nbsp; 2 0 2 4
              </div>
              <div className="flex gap-8 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                  <button className="hover:text-[#00ff9d] transition-colors">⚙️ YÖNETİCİ GİRİŞİ</button>
                  <button className="hover:text-[#00ff9d] transition-colors">DESTEK</button>
                  <button className="hover:text-[#00ff9d] transition-colors">KVKK</button>
              </div>
          </div>
      </footer>

      {/* AUTH MODAL */}
      {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowAuthModal(false)}></div>
              
              <div className="bg-[#111114] border border-white/10 w-full max-w-md rounded-2xl p-8 relative z-10 shadow-3xl">
                  <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>

                  <h3 className="text-2xl font-black mb-2 italic uppercase">{isLoginMode ? 'Giriş Yap' : 'Hesap Oluştur'}</h3>
                  <p className="text-gray-500 text-sm mb-8 font-medium">Workigom güvenli bölgesine erişim sağlayın.</p>

                  {error && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-xs font-bold uppercase tracking-widest">
                          ⚠️ {error}
                      </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                      {!isLoginMode && (
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">İsim</label>
                              <input 
                                  type="text"
                                  value={name}
                                  onChange={(e) => setName(e.target.value)}
                                  className="w-full bg-[#1a1a1e] border border-white/5 focus:border-[#00ff9d] rounded-xl px-4 py-4 outline-none transition-all text-sm font-bold text-white placeholder:text-gray-700"
                                  placeholder="Tam Adınız"
                                  required={!isLoginMode}
                              />
                          </div>
                      )}

                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-Posta</label>
                          <input 
                              type="email" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full bg-[#1a1a1e] border border-white/5 focus:border-[#00ff9d] rounded-xl px-4 py-4 outline-none transition-all text-sm font-bold text-white placeholder:text-gray-700"
                              placeholder="mail@workigom.com"
                              required
                          />
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Şifre</label>
                          <input 
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)} 
                              className="w-full bg-[#1a1a1e] border border-white/5 focus:border-[#00ff9d] rounded-xl px-4 py-4 outline-none transition-all text-sm font-bold text-white placeholder:text-gray-700"
                              placeholder="••••••••"
                              required
                          />
                      </div>

                      <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Oda Seçimi</label>
                           <select 
                                value={selectedRoomId}
                                onChange={(e) => setSelectedRoomId(e.target.value)}
                                className="w-full bg-[#1a1a1e] border border-white/5 focus:border-[#00ff9d] rounded-xl px-4 py-4 outline-none transition-all text-sm font-bold text-white appearance-none"
                           >
                               {ROOMS.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                           </select>
                      </div>

                      <button 
                          type="submit" 
                          disabled={isLoading}
                          className="w-full py-5 bg-[#00ff9d] text-black font-black rounded-xl shadow-lg shadow-[#00ff9d]/10 hover:bg-[#05e58d] transition-all transform active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-widest text-xs"
                      >
                          {isLoading ? 'Doğrulanıyor...' : (isLoginMode ? 'Sisteme Bağlan' : 'Başvuruyu Tamamla')}
                      </button>
                  </form>

                  <div className="mt-8 text-center">
                      <button 
                          onClick={() => { setIsLoginMode(!isLoginMode); setError(null); }}
                          className="text-gray-500 hover:text-[#00ff9d] font-bold text-xs uppercase tracking-widest transition-colors"
                      >
                          {isLoginMode ? 'Kayıtlı değil misin? BAŞVUR' : 'Zaten kayıtlı mısın? GİRİŞ YAP'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default JoinScreen;