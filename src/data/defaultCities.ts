import { City } from '../types';

export const DEFAULT_CITIES: City[] = [
  {
    id: 'lajeado',
    name: 'Lajeado',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 15.0, alerta: 17.0, inundacao: 19.0 },
    isDefault: true,
  },
  {
    id: 'estrela',
    name: 'Estrela',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 15.0, alerta: 17.0, inundacao: 19.0 },
    isDefault: true,
  },
  {
    id: 'arroio-do-meio',
    name: 'Arroio do Meio',
    riverName: 'Rio Taquari / Forqueta',
    thresholds: { atencao: 14.0, alerta: 16.0, inundacao: 18.0 },
    isDefault: true,
  },
  {
    id: 'bom-retiro-do-sul',
    name: 'Bom Retiro do Sul',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 10.0, alerta: 12.0, inundacao: 14.0 },
    isDefault: true,
  },
  {
    id: 'taquari',
    name: 'Taquari',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 8.0, alerta: 10.0, inundacao: 12.0 },
    isDefault: true,
  },
  {
    id: 'encantado',
    name: 'Encantado',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 11.0, alerta: 13.0, inundacao: 15.0 },
    isDefault: true,
  },
  {
    id: 'mucum',
    name: 'Muçum',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 18.0, alerta: 20.0, inundacao: 22.0 },
    isDefault: true,
  },
  {
    id: 'roca-sales',
    name: 'Roca Sales',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 9.0, alerta: 11.0, inundacao: 13.0 },
    isDefault: true,
  },
  {
    id: 'santa-tereza',
    name: 'Santa Tereza',
    riverName: 'Rio Taquari - Taquari/Das Antas',
    thresholds: { atencao: 10.0, alerta: 12.0, inundacao: 14.0 },
    isDefault: true,
  },
  {
    id: 'cruzeiro-do-sul',
    name: 'Cruzeiro do Sul',
    riverName: 'Rio Taquari',
    thresholds: { atencao: 15.0, alerta: 17.0, inundacao: 19.0 },
    isDefault: true,
  },
];

export function mergeWithDefaultCities(incoming: City[]): City[] {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return DEFAULT_CITIES;
  }

  // Clone items and separate any old joint 'Lajeado/Estrela' or 'Lajeado / Estrela' entries
  const updated = incoming.map(city => {
    if (city.id === 'lajeado' && (city.name === 'Lajeado/Estrela' || city.name === 'Lajeado / Estrela')) {
      return { ...city, name: 'Lajeado' };
    }
    return city;
  });

  const existingIds = new Set(updated.map(c => c.id));

  // Add missing default cities (including Estrela, Cruzeiro do Sul, etc.)
  DEFAULT_CITIES.forEach(defCity => {
    if (!existingIds.has(defCity.id)) {
      updated.push(defCity);
      existingIds.add(defCity.id);
    }
  });

  return updated;
}


