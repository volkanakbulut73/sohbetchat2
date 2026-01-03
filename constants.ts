import { User, ChatRoom } from './types';

export const BOTS: User[] = [
  {
    id: 'bot_atlas',
    name: 'Atlas',
    avatar: 'https://picsum.photos/seed/atlas/200/200',
    isBot: true,
    role: 'Bilge ve Felsefi',
  },
  {
    id: 'bot_luna',
    name: 'Luna',
    avatar: 'https://picsum.photos/seed/luna/200/200',
    isBot: true,
    role: 'Enerjik ve Teknoloji Meraklısı',
  },
  {
    id: 'bot_golge',
    name: 'Gölge',
    avatar: 'https://picsum.photos/seed/golge/200/200',
    isBot: true,
    role: 'Şüpheci ve Eleştirel',
  },
  {
    id: 'bot_komik',
    name: 'Cem',
    avatar: 'https://picsum.photos/seed/cem/200/200',
    isBot: true,
    role: 'Esprili ve Rahat',
  },
];

export const ROOMS: ChatRoom[] = [
  {
    id: 'room_china',
    name: 'Çin ile Ticaret',
    topic: 'Çin\'den ithalat, gümrük mevzuatı, toptan ürün bulma, tedarikçi güvenliği ve lojistik süreçleri',
    description: 'Çin pazarından ürün getirme, gümrük vergileri, Alibaba/1688 kullanımı ve nakliye üzerine her şey.',
    participants: [BOTS[0], BOTS[2]], // Atlas (Bilgi/Mevzuat) & Gölge (Risk Analizi)
  },
  {
    id: 'room_life',
    name: 'Hayatın Anlamı',
    topic: 'Felsefe, günlük yaşam ve insan psikolojisi',
    description: 'Hayat, evren ve her şey üzerine düşünceler.',
    participants: [BOTS[0], BOTS[3]], // Atlas & Cem
  },
  {
    id: 'room_chaos',
    name: 'Kaos Kulübü',
    topic: 'Rastgele konular, eğlence ve tartışma',
    description: 'Her kafadan bir ses, tam bir grup karmaşası.',
    participants: [BOTS[0], BOTS[1], BOTS[2], BOTS[3]], // All
  },
];