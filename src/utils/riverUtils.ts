import { AlertStatus, CityThresholds, RiverReading, CalculatedReading, City } from '../types';

/**
 * Generates array of standard 15-minute time intervals for a 24h day
 * e.g., ["00:00", "00:15", "00:30", "00:45", ..., "23:45"]
 */
export function generateStandardTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:15`);
    slots.push(`${hh}:30`);
    slots.push(`${hh}:45`);
  }
  return slots;
}

/**
 * Determines alert status based on river level and city threshold limits.
 * If atencao or alerta thresholds are set to 0 (zeradas), they are ignored
 * and status relies on the remaining non-zero thresholds (e.g. inundacao).
 */
export function getAlertStatus(level: number, thresholds: CityThresholds): AlertStatus {
  if (thresholds.inundacao > 0 && level >= thresholds.inundacao) return 'inundacao';
  if (thresholds.alerta > 0 && level >= thresholds.alerta) return 'alerta';
  if (thresholds.atencao > 0 && level >= thresholds.atencao) return 'atencao';
  return 'normal';
}

/**
 * Get readable label in Portuguese for alert status
 */
export function getStatusLabel(status: AlertStatus): string {
  switch (status) {
    case 'inundacao': return 'Cota de Inundação';
    case 'alerta': return 'Cota de Alerta';
    case 'atencao': return 'Cota de Atenção';
    case 'normal': return 'Nível Normal';
  }
}

/**
 * Return badge style styling classes
 */
export function getStatusBadgeStyle(status: AlertStatus): { bg: string; text: string; border: string; dot: string } {
  switch (status) {
    case 'inundacao':
      return {
        bg: 'bg-red-50 dark:bg-red-950/40',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500 animate-pulse',
      };
    case 'alerta':
      return {
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
        dot: 'bg-orange-500',
      };
    case 'atencao':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case 'normal':
    default:
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
  }
}

/**
 * Fast helper to get a comparable string key (YYYY-MM-DDTHH:mm) for sorting with zero Date allocations
 */
export function getReadingFastKey(r: { timestamp: string; dateStr?: string; timeStr?: string }): string {
  if (r.dateStr && r.timeStr) {
    return `${r.dateStr}T${r.timeStr}`;
  }
  return r.timestamp || '';
}

/**
 * Fast parse timestamp in milliseconds for time differences
 */
export function getReadingFastTimeMs(r: { timestamp: string; dateStr?: string; timeStr?: string }): number {
  if (r.dateStr && r.timeStr) {
    const y = parseInt(r.dateStr.slice(0, 4), 10);
    const m = parseInt(r.dateStr.slice(5, 7), 10);
    const d = parseInt(r.dateStr.slice(8, 10), 10);
    const hh = parseInt(r.timeStr.slice(0, 2), 10);
    const mm = parseInt(r.timeStr.slice(3, 5), 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
      return Date.UTC(y, m - 1, d, hh, mm);
    }
  }
  return new Date(r.timestamp).getTime() || 0;
}

/**
 * Deduplicates readings for the same city on the same date/time bucket (15 min window)
 * prioritizing real auto-synced readings over seed readings.
 */
export function deduplicateReadings(readings: RiverReading[]): RiverReading[] {
  // Fast string sort descending without Date objects
  const sorted = [...readings].sort((a, b) => {
    const ka = getReadingFastKey(a);
    const kb = getReadingFastKey(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });

  const resultMap = new Map<string, RiverReading>();

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!r || !r.cityId || !r.dateStr || !r.timeStr) continue;
    const parts = r.timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const bucketMins = isNaN(m) ? 0 : Math.floor(m / 15) * 15;
    const bucketHH = isNaN(h) ? '00' : String(h).padStart(2, '0');
    const bucketMM = String(bucketMins).padStart(2, '0');
    const bucketKey = `${r.cityId}_${r.dateStr}_${bucketHH}:${bucketMM}`;

    if (!resultMap.has(bucketKey)) {
      resultMap.set(bucketKey, r);
    } else {
      const existing = resultMap.get(bucketKey)!;
      // Prefer real synced reading over seed reading
      if (existing.id.startsWith('seed-') && !r.id.startsWith('seed-')) {
        resultMap.set(bucketKey, r);
      }
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Calculates rate of variation (in meters per hour) for sorted readings
 */
export function calculateCalculatedReadings(readings: RiverReading[], cities: City[]): CalculatedReading[] {
  const cityMap = new Map(cities.map(c => [c.id, c]));
  const cleanReadings = deduplicateReadings(readings);
  
  // Group readings by city
  const byCity = new Map<string, RiverReading[]>();
  for (let i = 0; i < cleanReadings.length; i++) {
    const r = cleanReadings[i];
    let arr = byCity.get(r.cityId);
    if (!arr) {
      arr = [];
      byCity.set(r.cityId, arr);
    }
    arr.push(r);
  }

  const result: CalculatedReading[] = [];

  byCity.forEach((cityReadings, cityId) => {
    const city = cityMap.get(cityId);
    const cityName = city ? city.name : 'Cidade Desconhecida';
    const thresholds = city ? city.thresholds : { atencao: 15, alerta: 17, inundacao: 19 };

    // Sort chronologically ascending using fast keys
    const sorted = [...cityReadings].sort((a, b) => {
      const ka = getReadingFastKey(a);
      const kb = getReadingFastKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    let prevTimeMs = 0;
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currTimeMs = getReadingFastTimeMs(current);
      let rate: number | null = null;

      if (i > 0 && prevTimeMs > 0 && currTimeMs > prevTimeMs) {
        const diffHours = (currTimeMs - prevTimeMs) / 3600000;
        if (diffHours > 0 && diffHours <= 24) { // Only calculate rate for gaps under 24 hours
          const diffMeters = current.levelMeters - sorted[i - 1].levelMeters;
          rate = diffMeters / diffHours;
        }
      }
      prevTimeMs = currTimeMs;

      result.push({
        ...current,
        cityName,
        status: getAlertStatus(current.levelMeters, thresholds),
        variationMeterPerHour: rate,
      });
    }
  });

  // Return sorted descending by fast key
  return result.sort((a, b) => {
    const ka = getReadingFastKey(a);
    const kb = getReadingFastKey(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  });
}

// Reusable singletons to prevent heavy instantiation overhead in loops
const brtDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const brtTimeFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
const brtFullFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export function formatDateTimeBR(isoString: string, dateStr?: string, timeStr?: string): string {
  if (dateStr && timeStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]} às ${timeStr}`;
    }
  }
  try {
    if (isoString && isoString.includes('T')) {
      const [dPart, tPart] = isoString.split('T');
      const parts = dPart.split('-');
      const timeClean = tPart.substring(0, 5);
      if (parts.length === 3 && timeClean.length === 5) {
        return `${parts[2]}/${parts[1]}/${parts[0]} às ${timeClean}`;
      }
    }
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return brtFullFormatter.format(date);
  } catch {
    return isoString;
  }
}

export function formatDateShort(dateStr: string): string {
  // input YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

export function getTodayDateStr(): string {
  return brtDateFormatter.format(new Date());
}

export function getCurrentTimeNearest15(): string {
  const timeRaw = brtTimeFormatter.format(new Date());
  const [hStr, mStr] = timeRaw.split(':');
  let hours = parseInt(hStr, 10) || 0;
  let minutes = parseInt(mStr, 10) || 0;

  if (minutes < 8) {
    minutes = 0;
  } else if (minutes < 23) {
    minutes = 15;
  } else if (minutes < 38) {
    minutes = 30;
  } else if (minutes < 53) {
    minutes = 45;
  } else {
    minutes = 0;
    hours = (hours + 1) % 24;
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getCurrentTimeNearest30(): string {
  return getCurrentTimeNearest15();
}
