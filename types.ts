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

export interface User {
  id: string;
  role: UserRole;
  name: string;
}
