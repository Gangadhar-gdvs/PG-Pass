export type SharingType = '1' | '2' | '3' | '4' | '5' | '6';
export type AcType = 'ac' | 'non-ac';
export type PgCategory = 'gents' | 'ladies' | 'coliving';
export type FoodPlan = '3_meals' | '2_meals' | 'no_food';
export type FoodCuisine = 'both' | 'south' | 'north';

export interface SharingFormatOption {
  sharing: SharingType;
  label: string;
  defaultRent: number; // in Rupees
  defaultAcRent: number; // in Rupees
  capacity: number; // beds per room
  description: string;
}

export const SHARING_FORMATS: SharingFormatOption[] = [
  {
    sharing: '1',
    label: 'Single Room',
    defaultRent: 13500,
    defaultAcRent: 15500,
    capacity: 1,
    description: 'Private room with single occupancy',
  },
  {
    sharing: '2',
    label: '2-Sharing',
    defaultRent: 9000,
    defaultAcRent: 10500,
    capacity: 2,
    description: 'Double occupancy room (2 beds)',
  },
  {
    sharing: '3',
    label: '3-Sharing',
    defaultRent: 7000,
    defaultAcRent: 8500,
    capacity: 3,
    description: 'Triple occupancy room (3 beds)',
  },
  {
    sharing: '4',
    label: '4-Sharing',
    defaultRent: 5800,
    defaultAcRent: 7000,
    capacity: 4,
    description: 'Quad occupancy room (4 beds)',
  },
  {
    sharing: '5',
    label: '5-Sharing',
    defaultRent: 5000,
    defaultAcRent: 6000,
    capacity: 5,
    description: 'Spacious 5-bed dormitory layout',
  },
  {
    sharing: '6',
    label: '6-Sharing',
    defaultRent: 4500,
    defaultAcRent: 5500,
    capacity: 6,
    description: 'Economical 6-bed dormitory layout',
  },
];

export interface AmenityOption {
  id: string;
  label: string;
  category: 'food' | 'utility' | 'safety' | 'comfort';
  icon: string;
}

export const PG_AMENITIES_LIST: AmenityOption[] = [
  { id: 'wifi', label: 'High-Speed Wi-Fi (Fiber)', category: 'utility', icon: 'Wifi' },
  { id: 'food', label: '3-Times Homestyle Food', category: 'food', icon: 'Utensils' },
  { id: 'power_backup', label: '24/7 Generator / Power Backup', category: 'utility', icon: 'Zap' },
  { id: 'washing_machine', label: 'Washing Machine & Laundry Area', category: 'utility', icon: 'Shirt' },
  { id: 'cleaning', label: 'Daily Housekeeping & Room Cleaning', category: 'comfort', icon: 'Sparkles' },
  { id: 'ro_water', label: 'RO Mineral Drinking Water', category: 'utility', icon: 'Droplet' },
  { id: 'cctv', label: 'CCTV Surveillance & Biometric / Pass Security', category: 'safety', icon: 'Shield' },
  { id: 'lift', label: 'Lift / Elevator', category: 'comfort', icon: 'ArrowUpDown' },
  { id: 'parking', label: '2-Wheeler / 4-Wheeler Parking', category: 'utility', icon: 'Car' },
  { id: 'refrigerator', label: 'Common Refrigerator', category: 'utility', icon: 'Refrigerator' },
  { id: 'geyser', label: '24/7 Hot Water / Geysers', category: 'comfort', icon: 'Flame' },
];

export const ROOM_AMENITIES_LIST = [
  { id: 'attached_washroom', label: 'Attached Washroom' },
  { id: 'ac', label: 'Air Conditioner (AC)' },
  { id: 'wooden_cupboard', label: 'Individual Wooden Wardrobe' },
  { id: 'study_table', label: 'Study Table & Chair' },
  { id: 'balcony', label: 'Private Balcony' },
  { id: 'bedside_socket', label: 'Bedside Socket & Lamp' },
  { id: 'mattress_pillow', label: 'Premium Mattress & Pillow' },
];
