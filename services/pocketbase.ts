
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
    } catch (e) {
        // Koleksiyon yoksa veya hata varsa güvenli davranıp ban yok sayıyoruz, 
        // production'da loglanmalı.
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
      isBot: false,
      isAdmin: record.isAdmin,
      isOp: record.isOp
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

// --- ADMIN / OP ACTIONS ---

// Kullanıcıyı Ban Listesine Ekle
export const banUser = async (targetUserId: string, targetEmail: string) => {
    try {
        // 1. banned_users koleksiyonuna ekle
        await pb.collection('banned_users').create({
            email: targetEmail,
            user_id: targetUserId
        });
        
        // 2. Kullanıcıyı anlık olarak sistemden atmak için flag'ini güncelle (opsiyonel, kick yeterli olabilir ama bu kalıcı)
        // Eğer 'isBanned' alanı varsa user şemasında:
        // await pb.collection('users').update(targetUserId, { isBanned: true });
        
        // Şimdilik Kick mekanizmasını tetikleyelim ki hemen düşsün
        await kickUser(targetUserId);

    } catch (e) {
        console.error("Banlama hatası:", e);
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
    } catch (e) {
        console.error("Ban listesi hatası:", e);
        return [];
    }
};

// Ban Kaldır
export const unbanUser = async (banRecordId: string) => {
    try {
        await pb.collection('banned_users').delete(banRecordId);
    } catch (e) {
        console.error("Ban kaldırma hatası:", e);
        throw e;
    }
};

// Kullanıcıyı At (Kick)
// Bu fonksiyon kullanıcının 'kicked' alanını true yapar (veya timestamp günceller).
// Frontend bunu dinler ve çıkış yapar.
export const kickUser = async (targetUserId: string) => {
    try {
        // Timestamp veya boolean kullanarak değişiklik tetikle
        // 'kicked' alanı boolean assumed
        await pb.collection('users').update(targetUserId, {
            kicked: true
        });
        
        // Bir süre sonra tekrar false yapılabilir server-side hook ile veya login'de
        // Ancak basitlik adına, kullanıcı tekrar login olduğunda bu değer false yapılmalı (login'de update)
        // Ya da client tarafında 'kick' yediğinde logout olur, tekrar girince 'login' fonksiyonu bu değeri resetleyebilir.
    } catch (e) {
        console.error("Kick hatası:", e);
        throw e;
    }
};

// Operatör Yap / Geri Al
export const setUserOpStatus = async (targetUserId: string, isOp: boolean) => {
    try {
        await pb.collection('users').update(targetUserId, {
            isOp: isOp
        });
    } catch (e) {
        console.error("Op yetkisi değiştirme hatası:", e);
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
