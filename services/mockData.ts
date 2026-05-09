import { Driver } from '../types';

export const MERCHANTS = [
  { id: 'm1', name: 'Island Provisions' },
  { id: 'm2', name: 'Caribbean Seafoods' },
  { id: 'm3', name: 'Antigua Marine Supply' },
  { id: 'm4', name: 'Tropical Logistics' }
];

export const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'd1',
    name: 'Marcus Holloway',
    avatar: 'https://picsum.photos/100/100',
    isOnline: true,
    latitude: 17.1274, // St. John's
    longitude: -61.8468,
    lastUpdate: Date.now(),
    heading: 45,
    status: 'IN_TRANSIT',
    cargo: [
      { id: 'c1', name: 'Resort Supplies', quantity: 45, destination: 'Dickenson Bay', merchantId: 'm1' },
      { id: 'c2', name: 'Seafood Cargo', quantity: 12, destination: 'Heritage Quay', merchantId: 'm2' }
    ]
  },
  {
    id: 'd2',
    name: 'Sarah Connor',
    avatar: 'https://picsum.photos/101/101',
    isOnline: true,
    latitude: 17.0079, // English Harbour
    longitude: -61.7656,
    lastUpdate: Date.now(),
    heading: 180,
    status: 'DELAYED',
    cargo: [
      { id: 'c3', name: 'Yacht Parts', quantity: 5, destination: 'Nelson\'s Dockyard', merchantId: 'm3' }
    ]
  },
  {
    id: 'd3',
    name: 'John Doe',
    avatar: 'https://picsum.photos/102/102',
    isOnline: true,
    latitude: 17.0683, // Jolly Harbour area
    longitude: -61.8890,
    lastUpdate: Date.now() - 3600000,
    status: 'DELIVERED',
    cargo: []
  },
  {
    id: 'd4',
    name: 'Elena Fisher',
    avatar: 'https://picsum.photos/103/103',
    isOnline: true,
    latitude: 17.1367, // VC Bird Airport
    longitude: -61.7926,
    lastUpdate: Date.now(),
    heading: 90,
    status: 'IN_TRANSIT',
    cargo: [
      { id: 'c4', name: 'Duty Free Goods', quantity: 20, destination: 'Airport Terminal', merchantId: 'm4' }
    ]
  },
  {
    id: 'd5',
    name: 'Nathan Drake',
    avatar: 'https://picsum.photos/104/104',
    isOnline: true,
    latitude: 17.0673, // All Saints
    longitude: -61.7942,
    lastUpdate: Date.now(),
    heading: 270,
    status: 'IN_TRANSIT',
    cargo: [
      { id: 'c5', name: 'Local Produce', quantity: 30, destination: 'Central Market', merchantId: 'm1' }
    ]
  },
  {
    id: 'd6',
    name: 'Lara Croft',
    avatar: 'https://picsum.photos/105/105',
    isOnline: true,
    latitude: 17.1165, // Five Islands
    longitude: -61.8762,
    lastUpdate: Date.now(),
    heading: 135,
    status: 'DELAYED',
    cargo: [
      { id: 'c6', name: 'Hotel Amenities', quantity: 15, destination: 'Royalton Resort', merchantId: 'm2' }
    ]
  }
];
