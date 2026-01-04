import PocketBase from 'pocketbase';
import { Message } from '../types';

// Kullanıcının sağladığı canlı sunucu adresi (HTTPS)
// Mixed Content hatasını önlemek için güvenli domain kullanılıyor.
const PB_URL = 'https://api.workigomchat.online';

export const pb = new PocketBase(PB_URL);

// Otomatik iptal işlemleri için
pb.autoCancellation(false);

export const loginOrRegister = async (username: string) => {
  const password = 'password123'; // Demo amaçlı sabit şifre. Gerçek uygulamada kullanıcı belirlemeli.
  const email = `${username.toLowerCase().replace(/\s+/g, '')}@chat.local`;

  try {
    // Önce giriş yapmayı dene
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  } catch (loginError) {
    try {
      // Giriş başarısızsa kullanıcı oluştur
      const userPayload = {
        username: username.toLowerCase().replace(/\s+/g, '').substring(0, 15) + Math.floor(Math.random() * 1000),
        email: email,
        emailVisibility: true,
        password: password,
        passwordConfirm: password,
        name: username,
      };
      
      await pb.collection('users').create(userPayload);
      // Oluşturduktan sonra giriş yap
      const authData = await pb.collection('users').authWithPassword(email, password);
      return authData.record;
    } catch (createError) {
      console.error("Kayıt hatası:", createError);
      throw createError;
    }
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
      image: record.image
    })) as Message[];

  } catch (error) {
    console.error("Mesajları getirme hatası:", error);
    return [];
  }
};

export const signOut = () => {
    pb.authStore.clear();
};