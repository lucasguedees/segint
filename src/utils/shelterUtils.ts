import { Shelter, ShelterReading, CalculatedShelterReading } from '../types';

/**
 * Maps raw shelter readings to calculated shelter readings with shelter details
 */
export function calculateCalculatedShelterReadings(
  readings: ShelterReading[],
  shelters: Shelter[]
): CalculatedShelterReading[] {
  const shelterMap = new Map<string, Shelter>();
  shelters.forEach(s => shelterMap.set(s.id, s));

  // Sort readings by timestamp descending (newest first)
  const sorted = [...readings].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return sorted.map(reading => {
    const shelter = shelterMap.get(reading.shelterId);
    const shelterName = shelter ? shelter.name : 'Abrigo não especificado';
    const cityName = shelter ? shelter.cityName : 'Cidade Desconhecida';

    return {
      ...reading,
      shelterName,
      cityName,
    };
  });
}

/**
 * Returns latest reading for a specific shelter
 */
export function getShelterLatestReading(
  shelterId: string,
  calculatedReadings: CalculatedShelterReading[]
): CalculatedShelterReading | null {
  const shelterReadings = calculatedReadings.filter(r => r.shelterId === shelterId);
  if (shelterReadings.length === 0) return null;
  return shelterReadings[0]; // sorted descending
}

/**
 * Get status label and styling for shelter status
 */
export function getShelterStatusBadgeStyle(status?: string) {
  if (status === 'inativo') {
    return {
      bg: 'bg-slate-800 text-slate-400 border-slate-700',
      label: 'Inativo / Fechado',
      dotColor: 'bg-slate-500',
    };
  }
  if (status === 'preparacao') {
    return {
      bg: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
      label: 'Em Preparação',
      dotColor: 'bg-blue-400',
    };
  }
  return {
    bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    label: 'Ativo / Aberto',
    dotColor: 'bg-emerald-500',
  };
}

/**
 * Format ISO or YYYY-MM-DD date to PT-BR string
 */
export function formatShelterDate(dateStr: string, timeStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return timeStr ? `${formatted} às ${timeStr}` : formatted;
  }
  return dateStr;
}
