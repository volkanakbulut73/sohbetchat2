
import PocketBase from 'pocketbase';
import { Message, User, BannedUser } from '../types';

// Kullanıcının sağladığı canlı sunucu adresi (HTTPS)
const PB_URL = 'https://api.workigomchat.online';

export const pb = new PocketBase(PB_URL);

// Otomatik iptal işlemleri için
pb.autoCancellation(false);

/**
 * Ban kontrolü
 */
const checkIfBanned = async (email: string) => {
    try {
        // banned_users koleksiyonunda bu email var mı?
        const records = await pb.collection('banned_users').getList(1, 1, {
            filter: `email = "${email}"`,
        });
        return records.items.length > 0;
    } catch (e: any) {
        // Koleksiyon yoksa (404) veya başka bir hata varsa güvenli davranıp ban yok sayıyoruz.
        // 404 hatası koleksiyonun henüz oluşturulmadığı anlamına gelir.
        if (e.status === 404) {
            return false;
        }
        
        console.warn("Ban kontrolü yapılamadı:", e);
        return false;
    }
}

/**
 * Mevcut kullanıcı ile giriş yap
 */
export const login = async (email: string, password: string) => {
  try {
    const isBanned = await checkIfBanned(email);
    if (isBanned) {
        throw new Error("Bu hesaba erişim engellenmiştir (BAN).");
    }

    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  } catch (error) {
    console.error("Giriş hatası:", error);
    throw error;
  }
};

/**
 * Yeni kullanıcı oluştur ve otomatik giriş yap
 */
export const register = async (email: string, password: string, name: string) => {
  try {
    const isBanned = await checkIfBanned(email);
    if (isBanned) {
        throw new Error("Bu e-posta adresi yasaklanmıştır.");
    }

    // 1. Kullanıcıyı oluştur
    const userPayload = {
      username: `user_${Math.floor(Math.random() * 1000000)}`, // Unique username generation
      email: email,
      emailVisibility: true,
      password: password,
      passwordConfirm: password,
      name: name,
      isAdmin: false, // Default
      isOp: false,    // Default
      kicked: false   // Default
    };
    
    await pb.collection('users').create(userPayload);

    // 2. Oluşturduktan sonra giriş yap
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  } catch (error) {
    console.error("Kayıt hatası:", error);
    throw error;
  }
};

/**
 * Sistemdeki tüm kullanıcıları getir
 */
export const getAllUsers = async () => {
  try {
    const records = await pb.collection('users').getFullList({
      sort: '-created',
    });
    return records.map(record => ({
      id: record.id,
      name: record.name || record.username,
      avatar: (record.avatar && record.avatar.startsWith('http')) 
        ? record.avatar 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.id}&backgroundColor=b6e3f4`,
      isAdmin: record.isAdmin,
      isOp: record.isOp,
      email: record.email // Ban işlemi için gerekli
    }));
  } catch (error) {
    console.error("Kullanıcıları getirme hatası:", error);
    return [];
  }
};

export const sendMessageToPb = async (msg: Omit<Message, 'id'>, roomId: string) => {
  try {
    const data = {
      text: msg.text,
      room: roomId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
      isUser: msg.isUser,
      image: msg.image || '',
      audio: msg.audio || '',
      timestamp: msg.timestamp.toISOString() // PB date formatı için
    };
    
    return await pb.collection('messages').create(data);
  } catch (error) {
    console.error("Mesaj gönderme hatası:", error);
    throw error;
  }
};

export const getRoomMessages = async (roomId: string) => {
  try {
    const resultList = await pb.collection('messages').getList(1, 50, {
      filter: `room = "${roomId}"`,
      sort: 'created', // Eskiden yeniye
      expand: 'senderId',
    });
    
    // PB record'larını bizim Message tipimize dönüştür
    return resultList.items.map(record => ({
      id: record.id,
      senderId: record.senderId,
      senderName: record.senderName,
      senderAvatar: record.senderAvatar,
      text: record.text,
      timestamp: new Date(record.created),
      isUser: record.isUser,
      image: record.image,
      audio: record.audio
    })) as Message[];

  } catch (error) {
    console.error("Mesajları getirme hatası:", error);
    return [];
  }
};

// --- ROOM STATE MUTE/UNMUTE ---

export const getRoomMuteStatus = async (roomId: string): Promise<boolean> => {
    try {
        // room_states tablosunda bu odaya ait kayıt var mı?
        const records = await pb.collection('room_states').getList(1, 1, {
            filter: `room_id = "${roomId}"`
        });
        if (records.items.length > 0) {
            return records.items[0].is_muted;
        }
        return false;
    } catch (e: any) {
        // Eğer collection yoksa varsayılan false dön
        if (e.status !== 404) console.error("Oda durumu çekilemedi:", e);
        return false;
    }
};

export const setRoomMuteStatus = async (roomId: string, isMuted: boolean) => {
    try {
        const records = await pb.collection('room_states').getList(1, 1, {
            filter: `room_id = "${roomId}"`
        });

        if (records.items.length > 0) {
            // Güncelle
            await pb.collection('room_states').update(records.items[0].id, {
                is_muted: isMuted
            });
        } else {
            // Oluştur
            await pb.collection('room_states').create({
                room_id: roomId,
                is_muted: isMuted
            });
        }
    } catch (e: any) {
        if (e.status === 404) {
            alert("HATA: 'room_states' tablosu bulunamadı. Lütfen PocketBase panelinde 'room_states' adında bir tablo oluşturun ve 'room_id' (text), 'is_muted' (bool) alanlarını ekleyin.");
        } else {
            console.error("Oda durumu değiştirilemedi:", e);
            throw e;
        }
    }
};

// --- ADMIN / OP ACTIONS ---

// Kullanıcıyı Ban Listesine Ekle
export const banUser = async (targetUserId: string, targetEmail: string) => {
    try {
        console.log(`Banlama işlemi başladı: ID=${targetUserId}, Email=${targetEmail}`);

        // 1. banned_users koleksiyonuna ekle
        // NOT: Bu işlemin çalışması için PocketBase 'banned_users' Create Rule: @request.auth.isAdmin = true olmalıdır.
        await pb.collection('banned_users').create({
            email: targetEmail,
            user_id: targetUserId
        });
        
        console.log("Ban kaydı veritabanına eklendi.");

        // 2. Kullanıcıyı anlık olarak sistemden atmak için flag'ini güncelle
        await kickUser(targetUserId);

    } catch (e: any) {
        console.error("Banlama hatası:", e);

        // Hata yönetimi
        if (e.status === 404) {
             const errMsg = "YETKİ HATASI: 'banned_users' tablosuna yazma izniniz yok. Lütfen PB panelinden 'API Rules > Create Rule' kısmına '@request.auth.isAdmin = true' ekleyin.";
             alert(errMsg);
             return;
        } else if (e.status === 400) {
             // Muhtemelen zaten banlı
             alert("Bu kullanıcı zaten banlı olabilir veya e-posta formatı hatalı.");
             // Yine de kick deneyelim
             await kickUser(targetUserId);
             return;
        }
        
        throw e;
    }
};

// Ban Listesini Getir
export const getBanList = async (): Promise<BannedUser[]> => {
    try {
        const list = await pb.collection('banned_users').getFullList({ sort: '-created' });
        return list.map(r => ({
            id: r.id,
            email: r.email,
            created: r.created
        }));
    } catch (e: any) {
        // Tablo yoksa boş liste dön, hata basma
        if (e.status === 404) return [];
        
        console.error("Ban listesi hatası:", e);
        return [];
    }
};

// Ban Kaldır
export const unbanUser = async (banRecordId: string) => {
    try {
        await pb.collection('banned_users').delete(banRecordId);
    } catch (e: any) {
        if (e.status === 404) {
             alert("'banned_users' tablosu bulunamadı veya silme izniniz yok (Delete Rule kontrolü yapın).");
             return;
         }
        console.error("Ban kaldırma hatası:", e);
        throw e;
    }
};

// Kullanıcıyı At (Kick)
// Bu fonksiyon kullanıcının 'kicked' alanını true yapar.
export const kickUser = async (targetUserId: string) => {
    try {
        await pb.collection('users').update(targetUserId, {
            kicked: true
        });
        console.log("Kullanıcı başarıyla kicklendi (Status güncellendi).");
    } catch (e: any) {
        console.error("Kick hatası:", e);
        if (e.status === 404) {
            throw new Error("YETKİ HATASI: 'users' tablosunda güncelleme izniniz yok. Lütfen PB panelinden Users > Update Rule ayarını kontrol edin.");
        }
        throw e;
    }
};

// Operatör Yap / Geri Al
export const setUserOpStatus = async (targetUserId: string, isOp: boolean) => {
    try {
        await pb.collection('users').update(targetUserId, {
            isOp: isOp
        });
    } catch (e: any) {
        console.error("Op yetkisi değiştirme hatası:", e);
        if (e.status === 404) {
            throw new Error("YETKİ HATASI: 'users' tablosunda güncelleme izniniz yok.");
        }
        throw e;
    }
};

// Login sonrası 'kicked' durumunu temizle
export const resetUserStatus = async (userId: string) => {
    try {
        await pb.collection('users').update(userId, { kicked: false });
    } catch (e) {
        // Sessiz hata
    }
}

export const signOut = () => {
    pb.authStore.clear();
};
