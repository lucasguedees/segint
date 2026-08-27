import { Shelter, ShelterReading } from '../types';

export const DEFAULT_SHELTERS: Shelter[] = [];

export const DEFAULT_DATA_SOURCES: string[] = [
  'Defesa Civil Municipal',
  'Assistência Social',
  'Cruz Vermelha',
  'Voluntários Registrados',
  'SACE SGB / CPRM'
];

export const DEFAULT_DEMOGRAPHIC_CATEGORIES: string[] = [
  'Homens',
  'Mulheres',
  'Crianças',
  'Idosos',
  'PCDs',
  'Animais de Estimação'
];

export function generateInitialShelterReadings(): ShelterReading[] {
  return [];
}
