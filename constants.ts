
import { User, ChatRoom } from './types';

// Bot listesi boşaltıldı
export const BOTS: User[] = [];

export const ROOMS: ChatRoom[] = [
  {
    id: 'room_china',
    name: 'Çin ile Ticaret',
    topic: 'Çin\'den ithalat, gümrük mevzuatı, toptan ürün bulma, tedarikçi güvenliği ve lojistik süreçleri',
    description: 'Çin pazarından ürün getirme, gümrük vergileri, Alibaba/1688 kullanımı ve nakliye üzerine her şey.',
    participants: [], // Botlar kaldırıldı
  },
  {
    id: 'room_life',
    name: 'Hayatın Anlamı',
    topic: 'Felsefe, günlük yaşam ve insan psikolojisi',
    description: 'Hayat, evren ve her şey üzerine düşünceler.',
    participants: [], // Botlar kaldırıldı
  },
  {
    id: 'room_chaos',
    name: 'Kaos Kulübü',
    topic: 'Rastgele konular, eğlence ve tartışma',
    description: 'Her kafadan bir ses, tam bir grup karmaşası.',
    participants: [], // Botlar kaldırıldı
  },
];
