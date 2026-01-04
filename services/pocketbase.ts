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