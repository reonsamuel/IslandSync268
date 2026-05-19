export enum UserRole {
  MERCHANT = 'MERCHANT',
  DRIVER = 'DRIVER',
  NONE = 'NONE'
}

export type DeliveryStatus = 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';

export interface CargoItem {
  id: string;
  name: string;
  quantity: number;
  destination: string;
  merchantId: string;
  status?: 'PENDING' | 'DELIVERED';
  proofOfDelivery?: string;
  signature?: string;
}

export interface Driver {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  latitude: number;
  longitude: number;
  cargo: CargoItem[];
  lastUpdate: number;
  heading?: number;
  status: DeliveryStatus;
  proofOfDelivery?: string;
  signature?: string;
}

export interface Merchant {
  id: string;
  name: string;
  sector: string;
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  role: UserRole;
  name: string;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  role: UserRole;
}

export interface Conversation {
  chatId: string;
  lastMessage: string;
  lastTimestamp: number;
  lastSenderName: string;
  lastSenderId: string;
  unreadMerchant?: boolean;
  unreadDriver?: boolean;
}
