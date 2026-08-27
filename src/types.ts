export type AlertStatus = 'normal' | 'atencao' | 'alerta' | 'inundacao';

export interface CityThresholds {
  atencao: number;   // Level in meters for Attention
  alerta: number;    // Level in meters for Alert
  inundacao: number; // Level in meters for Flood
}

export interface City {
  id: string;
  name: string;
  riverName?: string;
  thresholds: CityThresholds;
  isDefault?: boolean;
}

export interface RiverReading {
  id: string;
  cityId: string;
  timestamp: string; // ISO string YYYY-MM-DDTHH:mm
  dateStr: string;   // YYYY-MM-DD
  timeStr: string;   // HH:mm (00:00, 00:30, 01:00, etc.)
  levelMeters: number; // e.g., 14.85
  notes?: string;
  createdAt: string;
}

export interface CalculatedReading extends RiverReading {
  cityName: string;
  status: AlertStatus;
  variationMeterPerHour: number | null; // Speed of variation in m/h compared to previous reading
}

export type TimeInterval = '24h' | '48h' | '7d' | '30d' | 'all';

export type ShelterStatus = 'ativo' | 'preparacao' | 'inativo';

export interface Shelter {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  address?: string;
  contact?: string;
  status: ShelterStatus;
  createdAt: string;
}

export interface ShelterReading {
  id: string;
  shelterId: string;
  timestamp: string; // ISO string YYYY-MM-DDTHH:mm
  dateStr: string;   // YYYY-MM-DD
  timeStr: string;   // HH:mm
  peopleCount: number;
  familiesCount: number;
  demographics?: Record<string, number>; // e.g. { "Idosos": 15, "Adolescentes": 20, "Crianças": 30, "PCDs": 4, "Pets": 6 }
  dataSource: string; // e.g. "Defesa Civil", "Assistência Social"
  notes?: string;
  createdAt: string;
}

export interface CalculatedShelterReading extends ShelterReading {
  shelterName: string;
  cityName: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  category: string;
  description?: string;
  author?: string;
  createdAt: string;
  isFeatured?: boolean;
}

export type RoadBlockStatus = 'total' | 'parcial' | 'liberado';

export interface BlockedRoad {
  id: string;
  cityName: string;
  locationName: string; // Endereço, rua ou rodovia
  status: RoadBlockStatus;
  reason?: string; // Motivo da interdição
  imageUrl?: string; // Foto da via interditada
  latitude: number;
  longitude: number;
  reportedAt: string; // Data e hora do registro
  expectedRelease?: string; // Previsão de liberação
  notes?: string;
  createdAt: string;
}

