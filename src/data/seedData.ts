import { RiverReading } from '../types';

/**
 * Creates seed readings simulating recent river level behavior in Vale do Taquari
 * with 30-minute intervals over the past 24-36 hours.
 */
export function generateInitialSeedReadings(): RiverReading[] {
  const readings: RiverReading[] = [];
  const now = new Date();
  
  // Convert current time to America/Sao_Paulo BRT components
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const timeRaw = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const [nowH, nowM] = timeRaw.split(':').map(Number);
  
  // Create a base Date object representing current BRT time
  const [y, m, d] = todayStr.split('-').map(Number);
  const nowBRT = new Date(y, m - 1, d, nowH, nowM, 0);

  // Base river levels per city in meters matching current real data
  const cityBases: Record<string, { base: number; peak: number; phaseShift: number }> = {
    'lajeado': { base: 13.2, peak: 13.8, phaseShift: 0 },
    'estrela': { base: 13.2, peak: 13.8, phaseShift: 0 },
    'arroio-do-meio': { base: 13.2, peak: 13.8, phaseShift: 0 },
    'cruzeiro-do-sul': { base: 13.2, peak: 13.8, phaseShift: 0 },
    'bom-retiro-do-sul': { base: 10.2, peak: 10.9, phaseShift: 1 },
    'taquari': { base: 7.8, peak: 8.4, phaseShift: 2 },
    'roca-sales': { base: 7.2, peak: 7.8, phaseShift: 2 },
    'santa-tereza': { base: 4.8, peak: 5.2, phaseShift: 3 },
    'mucum': { base: 4.5, peak: 4.9, phaseShift: 4 },
    'encantado': { base: 3.1, peak: 3.4, phaseShift: 5 },
  };

  const totalPoints = 36; // last 18 hours in 30-min increments
  let counter = 1;

  for (let i = totalPoints; i >= 0; i--) {
    const timeOffsetMs = i * 30 * 60 * 1000;
    const pointDate = new Date(nowBRT.getTime() - timeOffsetMs);
    
    const year = pointDate.getFullYear();
    const month = String(pointDate.getMonth() + 1).padStart(2, '0');
    const day = String(pointDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const h = pointDate.getHours();
    const minVal = pointDate.getMinutes();
    const roundedMins = minVal < 30 ? '00' : '30';
    const roundedHH = String(h).padStart(2, '0');
    const timeStr = `${roundedHH}:${roundedMins}`;

    const timestamp = `${dateStr}T${timeStr}`;

    Object.entries(cityBases).forEach(([cityId, params]) => {
      // Simulate river rising curve (hydrograph wave passing through valley)
      const t = (totalPoints - i + params.phaseShift) / totalPoints;
      // Normal bell curve rise & slow decline
      const wave = Math.sin(Math.min(Math.PI, t * Math.PI));
      const variation = (params.peak - params.base) * wave;
      const noise = (Math.random() - 0.5) * 0.15;
      
      const level = Number((params.base + variation + noise).toFixed(2));

      let note = '';
      if (i === 18) note = 'Início de precipitação intensa na cabeceira';
      if (i === 6) note = 'Pico de elevação registrado';

      readings.push({
        id: `seed-${cityId}-${counter++}`,
        cityId,
        timestamp,
        dateStr,
        timeStr,
        levelMeters: Math.max(1.0, level),
        notes: note,
        createdAt: pointDate.toISOString(),
      });
    });
  }

  return readings;
}
