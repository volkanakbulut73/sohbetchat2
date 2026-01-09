
import PocketBase from 'pocketbase';
import { Message, User, BannedUser } from '../types';

// Kullanıcının sağladığı canlı sunucu adresi (HTTPS)
const PB_URL = 'https://api.workigomchat.online';

export const pb = new PocketBase(PB_URL);

// DEBUG: Konsol üzerinden erişim için (window.pb)
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.pb = pb;
}

// Otomatik iptal işlemleri için
pb.autoCancellation(false);

/**
 * Ban kontrolü
 */
const checkIfBanned = async (email: string) => {
    try {
        const records = await pb.collection('banned_users').getList(1, 1, {
            filter: `email = "${email}"`,
        });
        return records.items.length > 0;
    } catch (e: any) {
        if (e.status === 404) return false;
        return false;
    }
}

/**
 * Kullanıcı Online/Offline Durumunu Ayarla
 */
export const setUserOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
        await pb.collection('users').update(userId, { isOnline: isOnline });
    } catch (error) {}
};

/**
 * Sistem Mesajı Gönder (Giriş/Çıkış vb.)
 */
export const sendSystemNotification = async (user: User, text: string, roomId: string = 'general') => {
    try {
        // Örn: system_msg|Maho_ağa giriş yaptı
        const fullText = `system_msg|${user.name} ${text}`;
        
        const data = {
            text: fullText,
            room: roomId,
            senderId: user.id,
            senderName: user.name,
            senderAvatar: user.avatar,
            isUser: true, 
            timestamp: new Date().toISOString()
        };
        await pb.collection('messages').create(data);
    } catch (error) {}
};

/**
 * Mevcut kullanıcı ile giriş yap
 */
export const login = async (email: string, password: string) => {
  try {
    const isBanned = await checkIfBanned(email);
    if (isBanned) throw new Error("Bu hesaba erişim engellenmiştir (BAN).");
    const authData = await pb.collection('users').authWithPassword(email, password);
    await setUserOnlineStatus(authData.record.id, true);
    return authData.record;
  } catch (error) { throw error; }
};

/**
 * Yeni kullanıcı oluştur ve otomatik giriş yap
 */
export const register = async (email: string, password: string, name: string) => {
  try {
    const isBanned = await checkIfBanned(email);
    if (isBanned) throw new Error("Bu e-posta adresi yasaklanmıştır.");
    const userPayload = {
      username: `user_${Math.floor(Math.random() * 1000000)}`,
      email, emailVisibility: true, password, passwordConfirm: password,
      name, isAdmin: false, isOp: false, kicked: false, isOnline: true
    };
    await pb.collection('users').create(userPayload);
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  } catch (error) { throw error; }
};

/**
 * Sistemdeki tüm kullanıcıları getir
 */
export const getAllUsers = async () => {
  try {
    const records = await pb.collection('users').getFullList({ sort: '-created' });
    return records.map(record => ({
      id: record.id,
      name: record.name || record.username,
      avatar: (record.avatar && record.avatar.startsWith('http')) 
        ? record.avatar 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.id}&backgroundColor=b6e3f4`,
      isAdmin: record.isAdmin,
      isOp: record.isOp,
      email: record.email,
      isOnline: record.isOnline
    }));
  } catch (error) { return []; }
};

export const sendMessageToPb = async (msg: Omit<Message, 'id'>, roomId: string) => {
  try {
    const data = {
      text: msg.text, room: roomId, senderId: msg.senderId, senderName: msg.senderName,
      senderAvatar: msg.senderAvatar, isUser: msg.isUser, image: msg.image || '',
      audio: msg.audio || '', timestamp: msg.timestamp.toISOString()
    };
    return await pb.collection('messages').create(data);
  } catch (error) { throw error; }
};

export const getRoomMessages = async (roomId: string) => {
  try {
    const resultList = await pb.collection('messages').getList(1, 50, {
      filter: `room = "${roomId}"`, sort: 'created', expand: 'senderId',
    });
    return resultList.items.map(record => ({
      id: record.id, senderId: record.senderId, senderName: record.senderName,
      senderAvatar: record.senderAvatar, text: record.text,
      timestamp: new Date(record.created), isUser: record.isUser,
      image: record.image, audio: record.audio
    })) as Message[];
  } catch (error) { return []; }
};

export const getRoomMuteStatus = async (roomId: string): Promise<boolean> => {
    try {
        const records = await pb.collection('room_states').getList(1, 1, { filter: `room_id = "${roomId}"` });
        if (records.items.length > 0) return records.items[0].is_muted;
        return false;
    } catch (e) { return false; }
};

export const setRoomMuteStatus = async (roomId: string, isMuted: boolean) => {
    try {
        const records = await pb.collection('room_states').getList(1, 1, { filter: `room_id = "${roomId}"` });
        if (records.items.length > 0) await pb.collection('room_states').update(records.items[0].id, { is_muted: isMuted });
        else await pb.collection('room_states').create({ room_id: roomId, is_muted: isMuted });
    } catch (e) {}
};

export const banUser = async (targetUserId: string, targetEmail: string) => {
    try {
        await pb.collection('banned_users').create({ email: targetEmail, user_id: targetUserId });
        await kickUser(targetUserId);
    } catch (e) {}
};

export const getBanList = async (): Promise<BannedUser[]> => {
    try {
        const list = await pb.collection('banned_users').getFullList({ sort: '-created' });
        return list.map(r => ({ id: r.id, email: r.email, created: r.created }));
    } catch (e) { return []; }
};

export const unbanUser = async (banRecordId: string) => {
    try { await pb.collection('banned_users').delete(banRecordId); } catch (e) {}
};

export const kickUser = async (targetUserId: string) => {
    try { await pb.collection('users').update(targetUserId, { kicked: true }); } catch (e) {}
};

export const setUserOpStatus = async (targetUserId: string, isOp: boolean) => {
    try { await pb.collection('users').update(targetUserId, { isOp }); } catch (e) {}
};

export const resetUserStatus = async (userId: string) => {
    try { await pb.collection('users').update(userId, { kicked: false }); } catch (e) {}
}

export const signOut = async () => {
    if (pb.authStore.model?.id) await setUserOnlineStatus(pb.authStore.model.id, false);
    pb.authStore.clear();
};