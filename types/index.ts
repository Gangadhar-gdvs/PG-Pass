export type BedStatus = 'vacant' | 'occupied' | 'paid' | 'pending' | 'verify';
export type RentStatus = 'pending' | 'verify' | 'paid';

export interface Owner {
  id: string;
  phone: string;
  name: string;
  pgName: string;
  pgAddress: string;
  panNumber: string;
  upiId: string;
  totalFloors?: number;
  roomsPerFloor?: number;
  bedsPerRoom?: number;
  monthlyRent?: number;
  createdAt?: any;
}

export interface Bed {
  id: string;
  ownerId: string;
  floor: number;
  roomNumber: string;
  bedLabel: string;
  monthlyRent: number;
  status: BedStatus;
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
}

export interface Tenant {
  id: string;
  ownerId: string;
  bedId: string;
  bedLabel?: string;
  roomNumber?: string;
  monthlyRent?: number;
  name: string;
  phone: string;
  moveInDate: string;
  depositPaid: number;
  token: string; // unique unguessable public URL slug
  active: boolean;
  createdAt?: any;
}

export interface RentRecord {
  id: string;
  tenantId: string;
  tenantName?: string;
  bedId: string;
  bedLabel?: string;
  ownerId: string;
  monthYear: string; // "Nov-2026"
  amount: number;
  status: RentStatus;
  proofImageUrl?: string;
  paidDate?: string;
  createdAt?: any;
}

export interface MoveInPhoto {
  id: string;
  tenantId: string;
  ownerId: string;
  photoUrls: string[];
  timestamp?: any;
}
