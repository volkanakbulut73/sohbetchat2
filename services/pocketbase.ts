
import PocketBase from 'pocketbase';
import { Message } from '../types';

// Kullanıcının sağladığı canlı sunucu adresi (HTTPS)
const PB_URL = 'https://api.workigomchat.online';

export const pb = new PocketBase(PB_URL);

// Otomatik iptal işlemleri için
pb.autoCancellation(false);

/**
 * Mevcut kullanıcı ile giriş yap
 */
export const login = async (email: string, password: string) => {
  try {
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
    // 1. Kullanıcıyı oluştur
    const userPayload = {
      username: `user_${Math.floor(Math.random() * 1000000)}`, // Unique username generation
      email: email,
      emailVisibility: true,
      password: password,
      passwordConfirm: password,
      name: name,
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
      isBot: false
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

export const signOut = () => {
    pb.authStore.clear();
};
    