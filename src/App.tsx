import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsSummary } from './components/StatsSummary';
import { CityOverviewCards } from './components/CityOverviewCards';
import { RiverChart } from './components/RiverChart';
import { ReadingsTable } from './components/ReadingsTable';
import { ReadingFormModal } from './components/ReadingFormModal';
import { CityManagementModal } from './components/CityManagementModal';
import { AdminAuthModal } from './components/AdminAuthModal';

// Shelter Components
import { ShelterStatsSummary } from './components/Shelter/ShelterStatsSummary';
import { ShelterOverviewCards } from './components/Shelter/ShelterOverviewCards';
import { ShelterChart } from './components/Shelter/ShelterChart';
import { ShelterReadingsTable } from './components/Shelter/ShelterReadingsTable';
import { ShelterFormModal } from './components/Shelter/ShelterFormModal';
import { ShelterReadingFormModal } from './components/Shelter/ShelterReadingFormModal';
import { BlockedRoadsPage } from './components/RoadBlocks/BlockedRoadsPage';
import { VideosPage } from './components/Videos/VideosPage';
import { YouTubeVideoModal } from './components/Videos/YouTubeVideoModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';

import { City, RiverReading, CalculatedReading, Shelter, ShelterReading, CalculatedShelterReading, YouTubeVideo, BlockedRoad } from './types';
import { DEFAULT_CITIES, mergeWithDefaultCities } from './data/defaultCities';
import { generateInitialSeedReadings } from './data/seedData';
import { DEFAULT_SHELTERS, DEFAULT_DATA_SOURCES, generateInitialShelterReadings } from './data/shelterSeedData';
import { DEFAULT_VIDEOS, mergeWithDefaultVideos } from './data/defaultVideos';
import { generateInitialBlockedRoads } from './data/blockedRoadsSeedData';

import { calculateCalculatedReadings, deduplicateReadings } from './utils/riverUtils';
import { calculateCalculatedShelterReadings } from './utils/shelterUtils';
import { Info, Plus, Home, Waves, Users, Building2, Lock, CloudCheck, RefreshCw } from 'lucide-react';
import {
  subscribeCollection,
  saveDocument,
  deleteDocument,
  subscribeAppConfig,
  saveAppConfig,
  batchSaveDocuments
} from './lib/firebase';

const LOCAL_STORAGE_CITIES_KEY = 'taquari_flood_cities_v1';
const LOCAL_STORAGE_READINGS_KEY = 'taquari_flood_readings_v1';
const LOCAL_STORAGE_SHELTERS_KEY = 'taquari_shelters_v1';
const LOCAL_STORAGE_SHELTER_READINGS_KEY = 'taquari_shelter_readings_v1';
const LOCAL_STORAGE_DATA_SOURCES_KEY = 'taquari_datasources_v1';
const LOCAL_STORAGE_BLOCKED_ROADS_KEY = 'taquari_blocked_roads_v1';
const LOCAL_STORAGE_PIN_KEY = 'taquari_admin_pin_v1';
const SESSION_STORAGE_AUTH_KEY = 'taquari_admin_authorized_v1';

export default function App() {
  // Navigation tab state ('river' | 'shelters' | 'roads' | 'videos')
  const [activeTab, setActiveTab] = useState<'river' | 'shelters' | 'roads' | 'videos'>('river');

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('taquari_sidebar_collapsed_v1') === 'true';
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('taquari_sidebar_collapsed_v1', String(next));
      return next;
    });
  };

  // --- 0. Admin Authorization State (Public read access, PIN protected write access) ---
  const [adminPin, setAdminPin] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_PIN_KEY) || '234589';
  });

  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_STORAGE_AUTH_KEY) === 'true';
  });

  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [pendingActionName, setPendingActionName] = useState<string | null>(null);
  const [pendingActionCallback, setPendingActionCallback] = useState<(() => void) | null>(null);

  // --- 1. River State & Persistence ---
  const [cities, setCities] = useState<City[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CITIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return mergeWithDefaultCities(parsed);
      }
    } catch (e) {
      console.error('Error reading saved cities:', e);
    }
    return DEFAULT_CITIES;
  });

  const [readings, setReadings] = useState<RiverReading[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_READINGS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading saved readings:', e);
    }
    return generateInitialSeedReadings();
  });

  const [selectedCityId, setSelectedCityId] = useState<string | null>('lajeado');
  const [isReadingModalOpen, setIsReadingModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<RiverReading | null>(null);
  const [preselectedCityForModal, setPreselectedCityForModal] = useState<string | null>(null);

  // --- 2. Shelter State & Persistence ---
  const [shelters, setShelters] = useState<Shelter[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHELTERS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((s: any) => !s.id.startsWith('shelter-lajeado-') && !s.id.startsWith('shelter-estrela-') && !s.id.startsWith('shelter-arroio-') && !s.id.startsWith('shelter-cruzeiro-') && !s.id.startsWith('shelter-encantado-') && !s.id.startsWith('shelter-mucum-') && !s.id.startsWith('shelter-roca') && !s.id.startsWith('shelter-taquari-') && !s.id.startsWith('shelter-bomretiro-') && !s.id.startsWith('shelter-santatereza-') && !s.id.startsWith('shelter-teutonia-'));
      }
    } catch (e) {
      console.error('Error reading saved shelters:', e);
    }
    return [];
  });

  const [shelterReadings, setShelterReadings] = useState<ShelterReading[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SHELTER_READINGS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((sr: any) => !sr.id.startsWith('sr-'));
      }
    } catch (e) {
      console.error('Error reading saved shelter readings:', e);
    }
    return [];
  });

  const [dataSources, setDataSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DATA_SOURCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error reading saved data sources:', e);
    }
    return DEFAULT_DATA_SOURCES;
  });

  const [selectedShelterCity, setSelectedShelterCity] = useState<string>('all');
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [isShelterModalOpen, setIsShelterModalOpen] = useState(false);
  const [editingShelter, setEditingShelter] = useState<Shelter | null>(null);
  const [isShelterReadingModalOpen, setIsShelterReadingModalOpen] = useState(false);
  const [editingShelterReading, setEditingShelterReading] = useState<CalculatedShelterReading | null>(null);
  const [preselectedShelterForModal, setPreselectedShelterForModal] = useState<string | null>(null);

  // --- 3. YouTube Videos State & Persistence ---
  const [videos, setVideos] = useState<YouTubeVideo[]>(() => {
    try {
      const saved = localStorage.getItem('taquari_videos_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((v: any) => !v.id.startsWith('video-1') && !v.id.startsWith('video-2') && !v.id.startsWith('video-3') && !v.id.startsWith('video-4') && !v.id.startsWith('video-5') && !v.id.startsWith('video-6') && !v.id.startsWith('video-7') && !v.id.startsWith('video-8') && !v.id.startsWith('video-9') && !v.id.startsWith('video-10') && !v.id.startsWith('video-11') && !v.id.startsWith('video-12') && !v.id.startsWith('video-13') && !v.id.startsWith('video-14') && !v.id.startsWith('video-15') && !v.id.startsWith('video-16') && !v.id.startsWith('video-17') && !v.id.startsWith('video-18') && !v.id.startsWith('video-19') && !v.id.startsWith('video-20') && !v.id.startsWith('video-21'));
      }
    } catch (e) {}
    return [];
  });
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<YouTubeVideo | null>(null);

  // --- 4. Blocked Roads State & Persistence ---
  const [blockedRoads, setBlockedRoads] = useState<BlockedRoad[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_BLOCKED_ROADS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((r: any) => !['road-1', 'road-2', 'road-3', 'road-4', 'road-5', 'road-6', 'road-7', 'road-8'].includes(r.id));
      }
    } catch (e) {
      console.error('Error reading saved blocked roads:', e);
    }
    return [];
  });

  // --- Backup & Restore Modal State ---
  const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);

  // --- Firebase Real-time Subscriptions ---
  useEffect(() => {
    const unsubCities = subscribeCollection<City>('cities', (loadedCities) => {
      setCities(mergeWithDefaultCities(loadedCities));
    }, DEFAULT_CITIES);
    const unsubReadings = subscribeCollection<RiverReading>('readings', (loaded) => {
      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const timeRaw = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
      const maxKey = `${dateStr}T${timeRaw}`;

      const validReadings: RiverReading[] = [];

      for (const r of loaded) {
        const key = (r.dateStr && r.timeStr) ? `${r.dateStr}T${r.timeStr}` : r.timestamp;
        if (key <= maxKey) {
          validReadings.push(r);
        }
      }

      setReadings(validReadings);
    }, generateInitialSeedReadings());
    const unsubShelters = subscribeCollection<Shelter>('shelters', (items) => {
      setShelters(items.filter((s: any) => !s.id.startsWith('shelter-lajeado-') && !s.id.startsWith('shelter-estrela-') && !s.id.startsWith('shelter-arroio-') && !s.id.startsWith('shelter-cruzeiro-') && !s.id.startsWith('shelter-encantado-') && !s.id.startsWith('shelter-mucum-') && !s.id.startsWith('shelter-roca') && !s.id.startsWith('shelter-taquari-') && !s.id.startsWith('shelter-bomretiro-') && !s.id.startsWith('shelter-santatereza-') && !s.id.startsWith('shelter-teutonia-')));
    }, []);
    const unsubShelterReadings = subscribeCollection<ShelterReading>('shelterReadings', (items) => {
      setShelterReadings(items.filter((sr: any) => !sr.id.startsWith('sr-')));
    }, []);
    const unsubVideos = subscribeCollection<YouTubeVideo>('videos', (items) => {
      setVideos(items.filter((v: any) => !v.id.startsWith('video-1') && !v.id.startsWith('video-2') && !v.id.startsWith('video-3') && !v.id.startsWith('video-4') && !v.id.startsWith('video-5') && !v.id.startsWith('video-6') && !v.id.startsWith('video-7') && !v.id.startsWith('video-8') && !v.id.startsWith('video-9') && !v.id.startsWith('video-10') && !v.id.startsWith('video-11') && !v.id.startsWith('video-12') && !v.id.startsWith('video-13') && !v.id.startsWith('video-14') && !v.id.startsWith('video-15') && !v.id.startsWith('video-16') && !v.id.startsWith('video-17') && !v.id.startsWith('video-18') && !v.id.startsWith('video-19') && !v.id.startsWith('video-20') && !v.id.startsWith('video-21')));
    }, []);
    const unsubBlockedRoads = subscribeCollection<BlockedRoad>('blockedRoads', (items) => {
      setBlockedRoads(items.filter((r: any) => !['road-1', 'road-2', 'road-3', 'road-4', 'road-5', 'road-6', 'road-7', 'road-8'].includes(r.id)));
    }, []);
    const unsubPin = subscribeAppConfig('adminPin', (val) => {
      if (val) setAdminPin(val);
    });
    const unsubSources = subscribeAppConfig('dataSources', (val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDataSources(parsed);
          }
        } catch (e) {
          console.error('Error parsing dataSources from Firebase config:', e);
        }
      }
    });

    return () => {
      unsubCities();
      unsubReadings();
      unsubShelters();
      unsubShelterReadings();
      unsubVideos();
      unsubBlockedRoads();
      unsubPin();
      unsubSources();
    };
  }, []);

  // --- LocalStorage Sync Fallbacks ---
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_BLOCKED_ROADS_KEY, JSON.stringify(blockedRoads));
    } catch (e) {
      console.error('Failed to save blocked roads:', e);
    }
  }, [blockedRoads]);

  // --- LocalStorage Sync Fallbacks ---
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CITIES_KEY, JSON.stringify(cities));
    } catch (e) {
      console.error('Failed to save cities:', e);
    }
  }, [cities]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Save at most the latest 500 readings as offline fallback to prevent main-thread freeze
        const recentReadings = readings.length > 500 ? readings.slice(0, 500) : readings;
        localStorage.setItem(LOCAL_STORAGE_READINGS_KEY, JSON.stringify(recentReadings));
      } catch (e) {
        // Ignore quota error quietly
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [readings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SHELTERS_KEY, JSON.stringify(shelters));
    } catch (e) {
      console.error('Failed to save shelters:', e);
    }
  }, [shelters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const recentShelterReadings = shelterReadings.length > 500 ? shelterReadings.slice(0, 500) : shelterReadings;
        localStorage.setItem(LOCAL_STORAGE_SHELTER_READINGS_KEY, JSON.stringify(recentShelterReadings));
      } catch (e) {
        // Ignore quota error quietly
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [shelterReadings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_DATA_SOURCES_KEY, JSON.stringify(dataSources));
    } catch (e) {
      console.error('Failed to save data sources:', e);
    }
  }, [dataSources]);

  // --- Derived Calculated States ---
  const calculatedReadings = useMemo(() => {
    return calculateCalculatedReadings(readings, cities);
  }, [readings, cities]);

  const calculatedShelterReadings = useMemo(() => {
    return calculateCalculatedShelterReadings(shelterReadings, shelters);
  }, [shelterReadings, shelters]);

  // --- 0.1 Authorization Handlers ---
  const handleAuthorizeSuccess = () => {
    setIsAdminAuthorized(true);
    sessionStorage.setItem(SESSION_STORAGE_AUTH_KEY, 'true');
    setIsAdminAuthModalOpen(false);

    if (pendingActionCallback) {
      pendingActionCallback();
      setPendingActionCallback(null);
    }
    setPendingActionName(null);
  };

  const handleLogoutAdmin = () => {
    setIsAdminAuthorized(false);
    sessionStorage.removeItem(SESSION_STORAGE_AUTH_KEY);
  };

  const handleChangePin = (newPin: string) => {
    setAdminPin(newPin);
    localStorage.setItem(LOCAL_STORAGE_PIN_KEY, newPin);
    saveAppConfig('adminPin', newPin).catch(console.error);
  };

  const requireAdminAuth = (actionName: string, actionCallback: () => void) => {
    if (isAdminAuthorized) {
      actionCallback();
    } else {
      setPendingActionName(actionName);
      setPendingActionCallback(() => actionCallback);
      setIsAdminAuthModalOpen(true);
    }
  };

  // --- River Handlers & Auto-Sync ---
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastAutoSyncedAt, setLastAutoSyncedAt] = useState<string | null>(null);

  const performSilentAutoSync = async (isManual = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-river');
      const data = await res.json();
      if (data.success && Array.isArray(data.readings) && data.readings.length > 0) {
        setReadings(prev => {
          let updated = [...prev];
          data.readings.forEach((newR: any) => {
            // Check for existing reading for same city and date/time
            const existingIdx = updated.findIndex(
              r => r.cityId === newR.cityId &&
                   r.dateStr === newR.dateStr &&
                   r.timeStr === newR.timeStr
            );

            if (existingIdx !== -1) {
              // Update existing in place with official synced reading
              updated[existingIdx] = {
                ...updated[existingIdx],
                levelMeters: newR.levelMeters,
                notes: newR.notes || `Sincronizado via ${newR.source}`,
                timestamp: newR.timestamp,
              };
              saveDocument('readings', updated[existingIdx]).catch(console.error);
            } else {
              // Add new reading item
              const item: RiverReading = {
                id: `river-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                cityId: newR.cityId,
                timestamp: newR.timestamp,
                dateStr: newR.dateStr,
                timeStr: newR.timeStr,
                levelMeters: newR.levelMeters,
                notes: newR.notes || `Sincronizado via ${newR.source}`,
                createdAt: new Date().toISOString(),
              };
              updated = [item, ...updated];
              saveDocument('readings', item).catch(console.error);
            }
          });

          // Perform deduplication pass to ensure single reading per city per 15-min slot
          return deduplicateReadings(updated);
        });

        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setLastAutoSyncedAt(nowTime);

        if (isManual) {
          alert(`Sincronização concluída!\n\n${data.message}`);
        }
      } else if (isManual) {
        alert('Não foi possível obter os dados automatizados no momento.');
      }
    } catch (err) {
      console.error('Erro na sincronização:', err);
      if (isManual) {
        alert('Erro ao conectar ao serviço de captura automatizada de medições.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sincronização automática em segundo plano desativada momentaneamente a pedido do usuário.
  // A sincronização manual sob demanda via botão "Sincronizar Agora" está plenamente operacional.

  const handleSyncAutomatedReadings = () => {
    performSilentAutoSync(true);
  };

  const handleSaveReading = (readingData: Omit<RiverReading, 'id' | 'createdAt'> & { id?: string }) => {
    const existing = readingData.id ? readings.find(r => r.id === readingData.id) : undefined;
    const itemToSave: RiverReading = readingData.id
      ? {
          ...existing,
          ...readingData,
          createdAt: existing?.createdAt || new Date().toISOString(),
        } as RiverReading
      : {
          ...readingData,
          id: `reading-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString(),
        };

    setReadings(prev =>
      prev.some(r => r.id === itemToSave.id)
        ? prev.map(r => (r.id === itemToSave.id ? itemToSave : r))
        : [itemToSave, ...prev]
    );

    saveDocument('readings', itemToSave).catch(console.error);
  };

  const handleBatchSaveReadings = (newReadings: Omit<RiverReading, 'id' | 'createdAt'>[]) => {
    const now = Date.now();
    const itemsToSave: RiverReading[] = newReadings.map((r, index) => ({
      ...r,
      id: `reading-${now}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(now - index * 10).toISOString(),
    }));

    setReadings(prev => [...itemsToSave, ...prev]);

    itemsToSave.forEach(item => {
      saveDocument('readings', item).catch(console.error);
    });
  };

  const handleDeleteReading = (readingId: string) => {
    requireAdminAuth('Excluir registro de nível do rio', () => {
      setReadings(prev => {
        const remaining = prev.filter(r => r.id !== readingId);
        try {
          localStorage.setItem(LOCAL_STORAGE_READINGS_KEY, JSON.stringify(remaining));
        } catch (e) {}
        return remaining;
      });
      deleteDocument('readings', readingId).catch(console.error);
    });
  };

  const handleClearAllReadings = (idsToDelete?: string[]) => {
    requireAdminAuth('Excluir histórico de medições do rio', () => {
      const ids = idsToDelete || readings.map(r => r.id);
      if (ids.length === 0) return;
      if (confirm(`Tem certeza de que deseja excluir permanentemente ${ids.length} lançamento(s) do histórico de medições? Esta ação não pode ser desfeita.`)) {
        setReadings(prev => {
          const remaining = prev.filter(r => !ids.includes(r.id));
          try {
            localStorage.setItem(LOCAL_STORAGE_READINGS_KEY, JSON.stringify(remaining));
          } catch (e) {}
          return remaining;
        });
        ids.forEach(id => {
          deleteDocument('readings', id).catch(console.error);
        });
      }
    });
  };

  const handleEditReading = (reading: CalculatedReading) => {
    requireAdminAuth('Editar registro de nível do rio', () => {
      setEditingReading(reading);
      setIsReadingModalOpen(true);
    });
  };

  const handleAddCity = (cityData: Omit<City, 'id'>) => {
    requireAdminAuth('Adicionar Cidade', () => {
      const newCity: City = {
        ...cityData,
        id: `city-${Date.now()}-${cityData.name.toLowerCase().replace(/\s+/g, '-')}`,
      };
      setCities(prev => [...prev, newCity]);
      saveDocument('cities', newCity).catch(console.error);
    });
  };

  const handleUpdateCity = (updatedCity: City) => {
    requireAdminAuth('Atualizar Cota da Cidade', () => {
      setCities(prev => prev.map(c => (c.id === updatedCity.id ? updatedCity : c)));
      saveDocument('cities', updatedCity).catch(console.error);
    });
  };

  const handleDeleteCity = (cityId: string) => {
    requireAdminAuth('Excluir cidade do cadastro', () => {
      const city = cities.find(c => c.id === cityId);
      if (!city) return;
      if (city.isDefault) {
        return;
      }
      setCities(prev => prev.filter(c => c.id !== cityId));
      deleteDocument('cities', cityId).catch(console.error);
      if (selectedCityId === cityId) {
        setSelectedCityId('lajeado');
      }
    });
  };

  // --- Shelter Handlers ---
  const handleSaveShelter = (shelterData: Omit<Shelter, 'id' | 'createdAt'> & { id?: string }) => {
    requireAdminAuth('Salvar Cadastro de Abrigo', () => {
      const existing = shelterData.id ? shelters.find(s => s.id === shelterData.id) : undefined;
      const itemToSave: Shelter = shelterData.id
        ? {
            ...existing,
            ...shelterData,
            createdAt: existing?.createdAt || new Date().toISOString(),
          } as Shelter
        : {
            ...shelterData,
            id: `shelter-${Date.now()}-${shelterData.name.toLowerCase().replace(/\s+/g, '-')}`,
            createdAt: new Date().toISOString(),
          };

      setShelters(prev =>
        prev.some(s => s.id === itemToSave.id)
          ? prev.map(s => (s.id === itemToSave.id ? itemToSave : s))
          : [...prev, itemToSave]
      );

      saveDocument('shelters', itemToSave).catch(console.error);
    });
  };

  const handleDeleteShelter = (shelterId: string) => {
    const shelter = shelters.find(s => s.id === shelterId);
    if (!shelter) return;
    requireAdminAuth(`Excluir abrigo "${shelter.name}"`, () => {
      setShelters(prev => prev.filter(s => s.id !== shelterId));
      deleteDocument('shelters', shelterId).catch(console.error);
    });
  };

  const handleSaveShelterReading = (readingData: Omit<ShelterReading, 'id' | 'createdAt'> & { id?: string }) => {
    requireAdminAuth('Salvar Registro de Abrigo', () => {
      const existing = readingData.id ? shelterReadings.find(r => r.id === readingData.id) : undefined;
      const itemToSave: ShelterReading = readingData.id
        ? {
            ...existing,
            ...readingData,
            createdAt: existing?.createdAt || new Date().toISOString(),
          } as ShelterReading
        : {
            ...readingData,
            id: `shelter-reading-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
          };

      setShelterReadings(prev =>
        prev.some(r => r.id === itemToSave.id)
          ? prev.map(r => (r.id === itemToSave.id ? itemToSave : r))
          : [itemToSave, ...prev]
      );

      saveDocument('shelterReadings', itemToSave).catch(console.error);
    });
  };

  const handleDeleteShelterReading = (readingId: string) => {
    requireAdminAuth('Excluir registro histórico de abrigados', () => {
      setShelterReadings(prev => {
        const remaining = prev.filter(r => r.id !== readingId);
        try {
          localStorage.setItem(LOCAL_STORAGE_SHELTER_READINGS_KEY, JSON.stringify(remaining));
        } catch (e) {}
        return remaining;
      });
      deleteDocument('shelterReadings', readingId).catch(console.error);
    });
  };

  const handleClearAllShelterReadings = (idsToDelete?: string[]) => {
    requireAdminAuth('Excluir histórico de abrigados', () => {
      const ids = idsToDelete || shelterReadings.map(r => r.id);
      if (ids.length === 0) return;
      if (confirm(`Tem certeza de que deseja excluir permanentemente ${ids.length} lançamento(s) do histórico de abrigos? Esta ação não pode ser desfeita.`)) {
        setShelterReadings(prev => {
          const remaining = prev.filter(r => !ids.includes(r.id));
          try {
            localStorage.setItem(LOCAL_STORAGE_SHELTER_READINGS_KEY, JSON.stringify(remaining));
          } catch (e) {}
          return remaining;
        });
        ids.forEach(id => {
          deleteDocument('shelterReadings', id).catch(console.error);
        });
      }
    });
  };

  const handleEditShelterReading = (reading: CalculatedShelterReading) => {
    requireAdminAuth('Editar registro de abrigados', () => {
      setEditingShelterReading(reading);
      setIsShelterReadingModalOpen(true);
    });
  };

  const handleAddNewDataSource = (newSource: string) => {
    if (!dataSources.includes(newSource)) {
      const updated = [...dataSources, newSource];
      setDataSources(updated);
      saveAppConfig('dataSources', JSON.stringify(updated)).catch(console.error);
    }
  };

  // --- YouTube Video Handlers ---
  const handleSaveVideo = (videoData: Omit<YouTubeVideo, 'id' | 'createdAt'> & { id?: string }) => {
    const existing = videoData.id ? videos.find(v => v.id === videoData.id) : undefined;
    const itemToSave: YouTubeVideo = videoData.id
      ? {
          ...existing,
          ...videoData,
          createdAt: existing?.createdAt || new Date().toISOString(),
        } as YouTubeVideo
      : {
          ...videoData,
          id: `video-${Date.now()}-${videoData.youtubeId}`,
          createdAt: new Date().toISOString(),
        };

    setVideos(prev =>
      prev.some(v => v.id === itemToSave.id)
        ? prev.map(v => (v.id === itemToSave.id ? itemToSave : v))
        : [itemToSave, ...prev]
    );

    saveDocument('videos', itemToSave).catch(console.error);
  };

  const handleDeleteVideo = (videoId: string) => {
    requireAdminAuth('Excluir vídeo do YouTube', () => {
      if (confirm('Tem certeza que deseja excluir este vídeo do sistema?')) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
        deleteDocument('videos', videoId).catch(console.error);
      }
    });
  };

  const handleEditVideo = (video: YouTubeVideo) => {
    requireAdminAuth('Editar vídeo do YouTube', () => {
      setEditingVideo(video);
      setIsVideoModalOpen(true);
    });
  };

  // --- CSV Export Handlers ---
  const handleExportCSV = () => {
    if (activeTab === 'river') {
      if (calculatedReadings.length === 0) {
        alert('Não há registros de nível do rio para exportar.');
        return;
      }
      const headers = ['Cidade', 'Data', 'Horario', 'Nivel_Metros', 'Status', 'Variacao_m_h', 'Observacoes'];
      const rows = calculatedReadings.map(r => [
        `"${r.cityName}"`,
        `"${r.dateStr}"`,
        `"${r.timeStr}"`,
        r.levelMeters.toFixed(2),
        `"${r.status}"`,
        r.variationMeterPerHour !== null ? r.variationMeterPerHour.toFixed(2) : '',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitoramento_rio_taquari_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (calculatedShelterReadings.length === 0) {
        alert('Não há registros históricos de abrigos para exportar.');
        return;
      }
      const headers = ['Abrigo', 'Cidade', 'Data', 'Horario', 'Pessoas_Abrigadas', 'Familias_Abrigadas', 'Perfil_Grupos', 'Fonte_Dado', 'Observacoes'];
      const rows = calculatedShelterReadings.map(r => {
        const demoStr = r.demographics
          ? Object.entries(r.demographics).map(([k, v]) => `${k}:${v}`).join('; ')
          : 'Geral';
        return [
          `"${r.shelterName}"`,
          `"${r.cityName}"`,
          `"${r.dateStr}"`,
          `"${r.timeStr}"`,
          r.peopleCount,
          r.familiesCount,
          `"${demoStr}"`,
          `"${r.dataSource}"`,
          `"${(r.notes || '').replace(/"/g, '""')}"`,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitoramento_abrigos_taquari_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleResetSeedData = () => {
    requireAdminAuth('Restaurar dados padrão', () => {
      if (confirm('Deseja restaurar as configurações e dados demonstrativos padrão de rios e abrigos?')) {
        const seedReadings = generateInitialSeedReadings();
        const seedShelterReadings = generateInitialShelterReadings();

        setCities(DEFAULT_CITIES);
        setReadings(seedReadings);
        setShelters(DEFAULT_SHELTERS);
        setShelterReadings(seedShelterReadings);
        setDataSources(DEFAULT_DATA_SOURCES);
        setSelectedCityId('lajeado');
        setSelectedShelterId(null);

        localStorage.setItem(LOCAL_STORAGE_CITIES_KEY, JSON.stringify(DEFAULT_CITIES));
        localStorage.setItem(LOCAL_STORAGE_READINGS_KEY, JSON.stringify(seedReadings));
        localStorage.setItem(LOCAL_STORAGE_SHELTERS_KEY, JSON.stringify(DEFAULT_SHELTERS));
        localStorage.setItem(LOCAL_STORAGE_SHELTER_READINGS_KEY, JSON.stringify(seedShelterReadings));
        localStorage.setItem(LOCAL_STORAGE_DATA_SOURCES_KEY, JSON.stringify(DEFAULT_DATA_SOURCES));

        batchSaveDocuments('cities', DEFAULT_CITIES).catch(console.error);
        batchSaveDocuments('readings', seedReadings).catch(console.error);
        batchSaveDocuments('shelters', DEFAULT_SHELTERS).catch(console.error);
        batchSaveDocuments('shelterReadings', seedShelterReadings).catch(console.error);
      }
    });
  };

  // --- Modal Launch Helpers ---
  const handleOpenModalForCity = (cityId: string) => {
    requireAdminAuth('Cadastrar Nível do Rio', () => {
      setEditingReading(null);
      setPreselectedCityForModal(cityId);
      setIsReadingModalOpen(true);
    });
  };

  const handleOpenNewReadingModalGeneral = () => {
    requireAdminAuth('Cadastrar Nível do Rio', () => {
      setEditingReading(null);
      setPreselectedCityForModal(selectedCityId);
      setIsReadingModalOpen(true);
    });
  };

  const handleOpenShelterReadingModal = (shelterId?: string) => {
    requireAdminAuth('Lançar Ocupantes e Nível do Abrigo', () => {
      setEditingShelterReading(null);
      setPreselectedShelterForModal(shelterId || selectedShelterId || shelters[0]?.id || null);
      setIsShelterReadingModalOpen(true);
    });
  };

  const handleOpenNewShelterModal = () => {
    requireAdminAuth('Cadastrar Novo Abrigo', () => {
      setEditingShelter(null);
      setIsShelterModalOpen(true);
    });
  };

  const handleOpenEditShelterModal = (shelter: Shelter) => {
    requireAdminAuth(`Editar Abrigo "${shelter.name}"`, () => {
      setEditingShelter(shelter);
      setIsShelterModalOpen(true);
    });
  };

  const handleOpenNewCityModal = () => {
    requireAdminAuth('Gerenciar Cidades e Cotas de Alerta', () => {
      setIsCityModalOpen(true);
    });
  };

  const handleOpenNewVideoModal = () => {
    requireAdminAuth('Compartilhar Novo Vídeo do YouTube', () => {
      setEditingVideo(null);
      setIsVideoModalOpen(true);
    });
  };

  const handleRestoreBackup = async (backupData: {
    cities?: City[];
    readings?: RiverReading[];
    shelters?: Shelter[];
    shelterReadings?: ShelterReading[];
    videos?: YouTubeVideo[];
    blockedRoads?: BlockedRoad[];
    dataSources?: string[];
  }) => {
    if (backupData.cities && backupData.cities.length > 0) {
      setCities(backupData.cities);
      await batchSaveDocuments('cities', backupData.cities);
    }
    if (backupData.readings && backupData.readings.length > 0) {
      setReadings(backupData.readings);
      await batchSaveDocuments('readings', backupData.readings);
    }
    if (backupData.shelters && backupData.shelters.length > 0) {
      setShelters(backupData.shelters);
      await batchSaveDocuments('shelters', backupData.shelters);
    }
    if (backupData.shelterReadings && backupData.shelterReadings.length > 0) {
      setShelterReadings(backupData.shelterReadings);
      await batchSaveDocuments('shelterReadings', backupData.shelterReadings);
    }
    if (backupData.videos && backupData.videos.length > 0) {
      setVideos(backupData.videos);
      await batchSaveDocuments('videos', backupData.videos);
    }
    if (backupData.blockedRoads && backupData.blockedRoads.length > 0) {
      setBlockedRoads(backupData.blockedRoads);
      await batchSaveDocuments('blockedRoads', backupData.blockedRoads);
    }
    if (backupData.dataSources && backupData.dataSources.length > 0) {
      setDataSources(backupData.dataSources);
      await saveAppConfig('dataSources', JSON.stringify(backupData.dataSources));
    }
  };

  // --- Blocked Roads CRUD Handlers ---
  const handleAddBlockedRoad = async (roadData: Omit<BlockedRoad, 'id' | 'createdAt'>) => {
    const newRoad: BlockedRoad = {
      ...roadData,
      id: `road-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setBlockedRoads((prev) => {
      const updated = [newRoad, ...prev];
      try {
        localStorage.setItem(LOCAL_STORAGE_BLOCKED_ROADS_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    await saveDocument('blockedRoads', newRoad);
  };

  const handleUpdateBlockedRoad = async (id: string, updatedFields: Partial<BlockedRoad>) => {
    setBlockedRoads((prev) => {
      const updatedList = prev.map((r) => (r.id === id ? { ...r, ...updatedFields } : r));
      try {
        localStorage.setItem(LOCAL_STORAGE_BLOCKED_ROADS_KEY, JSON.stringify(updatedList));
      } catch (e) {}
      return updatedList;
    });
    const existing = blockedRoads.find((r) => r.id === id);
    if (existing) {
      const updated = { ...existing, ...updatedFields };
      await saveDocument('blockedRoads', updated);
    }
  };

  const handleDeleteBlockedRoad = (id: string) => {
    setBlockedRoads((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(LOCAL_STORAGE_BLOCKED_ROADS_KEY, JSON.stringify(remaining));
      } catch (e) {}
      return remaining;
    });
    deleteDocument('blockedRoads', id).catch((err) => {
      console.error('Erro ao excluir via interditada no Firebase:', err);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Collapsible Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenNewReadingModal={handleOpenNewReadingModalGeneral}
        onOpenNewCityModal={handleOpenNewCityModal}
        onOpenNewShelterReadingModal={() => handleOpenShelterReadingModal()}
        onOpenNewShelterModal={handleOpenNewShelterModal}
        onOpenNewVideoModal={handleOpenNewVideoModal}
        onOpenBackupRestoreModal={() => setIsBackupRestoreModalOpen(true)}
        onResetSeedData={handleResetSeedData}
        onExportCSV={handleExportCSV}
        readings={calculatedReadings}
        cities={cities}
        shelterReadings={calculatedShelterReadings}
        shelters={shelters}
        videosCount={videos.length}
        blockedRoadsCount={blockedRoads.length}
        isAdminAuthorized={isAdminAuthorized}
        onOpenAdminAuth={(actionName) => requireAdminAuth(actionName || 'Acesso Restrito ao Operador', () => {})}
        onLogoutAdmin={handleLogoutAdmin}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Container with dynamic margin for left sidebar */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
        
        {/* Main Content */}
        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ==================== TAB 1: RIO TAQUARI ==================== */}
        {activeTab === 'river' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Info Banner */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800/50 mt-0.5">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Bacia Hidrográfica do Taquari-Antas
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Níveis da água medidos em intervalos periódicos nas réguas das cidades do Vale do Taquari com alertas de cotas.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs rounded-xl font-medium shadow-inner"
                  title="Auto-sincronização periódica desativada momentaneamente. Clique em 'Sincronizar Agora' para atualizar sob demanda."
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
                  <span>Auto-Sync: Desativada {lastAutoSyncedAt ? `• Última sinc: ${lastAutoSyncedAt}` : ''}</span>
                </div>

                <button
                  onClick={handleSyncAutomatedReadings}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Sincronizar medições automaticamente das estações de monitoramento (Lajeado, Estrela, Arroio do Meio, Bom Retiro do Sul, Taquari, Encantado, Muçum, Roca Sales, Santa Tereza)"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>

                <button
                  onClick={handleOpenNewReadingModalGeneral}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer active:scale-95"
                  title="Lançar Nível do Rio (Manual ou CSV)"
                >
                  <Plus className="w-4 h-4" />
                  Lançar Nível
                </button>

                <button
                  id="btn-open-city-modal"
                  onClick={handleOpenNewCityModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  title="Gerenciar Cidades e Cotas de Alerta"
                >
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span>Gerenciar Cidades e Cotas</span>
                </button>
              </div>
            </div>

            {/* River Stats Strip */}
            <StatsSummary readings={calculatedReadings} cities={cities} />

            {/* City Overview Cards */}
            <CityOverviewCards
              cities={cities}
              readings={calculatedReadings}
              selectedCityId={selectedCityId}
              onSelectCity={setSelectedCityId}
              onOpenReadingModalForCity={handleOpenModalForCity}
              onOpenCityModal={handleOpenNewCityModal}
              isAdminAuthorized={isAdminAuthorized}
            />

            {/* River Chart */}
            <RiverChart
              cities={cities}
              readings={calculatedReadings}
              selectedCityId={selectedCityId}
              onSelectCity={setSelectedCityId}
            />

            {/* River Readings History Table */}
            <ReadingsTable
              readings={calculatedReadings}
              cities={cities}
              onEditReading={handleEditReading}
              onDeleteReading={handleDeleteReading}
              onClearAllReadings={handleClearAllReadings}
              onExportCSV={handleExportCSV}
              onSyncAutomatedReadings={handleSyncAutomatedReadings}
              isSyncing={isSyncing}
              isAdminAuthorized={isAdminAuthorized}
            />

          </div>
        )}

        {/* ==================== TAB 2: ABRIGOS E DESABRIGADOS ==================== */}
        {activeTab === 'shelters' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Info Banner for Shelters */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/50 mt-0.5">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    Monitoramento de Abrigos e Desabrigados
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-950 text-indigo-300 font-semibold rounded-md border border-indigo-800/60">
                      Gestão de Pessoas
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Acompanhamento do número de pessoas, famílias e abrigos ativos no Vale do Taquari.
                  </p>
                </div>
              </div>

              {isAdminAuthorized && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenNewShelterModal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Novo Abrigo
                  </button>

                  <button
                    onClick={() => handleOpenShelterReadingModal()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Lançar Dados de Abrigados
                  </button>
                </div>
              )}
            </div>

            {/* Shelter Stats Strip */}
            <ShelterStatsSummary shelters={shelters} readings={calculatedShelterReadings} />

            {/* Shelter Overview Cards */}
            <ShelterOverviewCards
              shelters={shelters}
              readings={calculatedShelterReadings}
              selectedCity={selectedShelterCity}
              onSelectCity={setSelectedShelterCity}
              selectedShelterId={selectedShelterId}
              onSelectShelter={setSelectedShelterId}
              onOpenReadingModal={handleOpenShelterReadingModal}
              onOpenEditShelterModal={handleOpenEditShelterModal}
              onOpenNewShelterModal={handleOpenNewShelterModal}
              onDeleteShelter={handleDeleteShelter}
              isAdminAuthorized={isAdminAuthorized}
            />

            {/* Shelter Progression Chart */}
            <ShelterChart
              shelters={shelters}
              readings={calculatedShelterReadings}
              selectedCity={selectedShelterCity}
              onSelectCity={setSelectedShelterCity}
              selectedShelterId={selectedShelterId}
              onSelectShelter={setSelectedShelterId}
            />

            {/* Shelter Historical Registration Table */}
            <ShelterReadingsTable
              readings={calculatedShelterReadings}
              shelters={shelters}
              selectedCity={selectedShelterCity}
              onEditReading={handleEditShelterReading}
              onDeleteReading={handleDeleteShelterReading}
              onClearAllReadings={handleClearAllShelterReadings}
              onExportCSV={handleExportCSV}
              onOpenNewReadingModal={() => handleOpenShelterReadingModal()}
              isAdminAuthorized={isAdminAuthorized}
            />

          </div>
        )}

        {/* ==================== TAB 3: VIAS INTERDITADAS ==================== */}
        {activeTab === 'roads' && (
          <BlockedRoadsPage
            blockedRoads={blockedRoads}
            onAddRoad={handleAddBlockedRoad}
            onUpdateRoad={handleUpdateBlockedRoad}
            onDeleteRoad={handleDeleteBlockedRoad}
            isAdminAuthorized={isAdminAuthorized}
            onRequestAdminAuth={(actionName, cb) => requireAdminAuth(actionName, cb)}
          />
        )}

        {/* ==================== TAB 4: VÍDEOS YOUTUBE ==================== */}
        {activeTab === 'videos' && (
          <VideosPage
            videos={videos}
            onOpenAddModal={handleOpenNewVideoModal}
            onEditVideo={handleEditVideo}
            onDeleteVideo={handleDeleteVideo}
            isAdminAuthorized={isAdminAuthorized}
            onOpenAdminAuth={() => requireAdminAuth('Acesso Restrito ao Operador', () => {})}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 text-xs py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-500" />
            <span className="font-semibold text-slate-300">
              Sistema de Monitoramento de Enchentes & Abrigos • Vale do Taquari
            </span>
          </div>
          <p className="text-slate-500">
            Monitoramento de níveis do rio e cadastro contínuo de pessoas e famílias desabrigadas
          </p>
        </div>
      </footer>
      </div>

      {/* Modals for River */}
      <ReadingFormModal
        isOpen={isReadingModalOpen}
        onClose={() => {
          setIsReadingModalOpen(false);
          setEditingReading(null);
        }}
        onSaveReading={handleSaveReading}
        onBatchSaveReadings={handleBatchSaveReadings}
        onOpenNewCityModal={() => setIsCityModalOpen(true)}
        cities={cities}
        initialCityId={preselectedCityForModal}
        editingReading={editingReading}
      />

      <CityManagementModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
        cities={cities}
        onAddCity={handleAddCity}
        onUpdateCity={handleUpdateCity}
        onDeleteCity={handleDeleteCity}
      />

      {/* Modals for Shelters */}
      <ShelterFormModal
        isOpen={isShelterModalOpen}
        onClose={() => {
          setIsShelterModalOpen(false);
          setEditingShelter(null);
        }}
        onSaveShelter={handleSaveShelter}
        cities={cities}
        editingShelter={editingShelter}
      />

      <ShelterReadingFormModal
        isOpen={isShelterReadingModalOpen}
        onClose={() => {
          setIsShelterReadingModalOpen(false);
          setEditingShelterReading(null);
        }}
        onSaveReading={handleSaveShelterReading}
        shelters={shelters}
        dataSources={dataSources}
        onAddNewDataSource={handleAddNewDataSource}
        initialShelterId={preselectedShelterForModal}
        editingReading={editingShelterReading}
      />

      {/* Modals for Videos */}
      <YouTubeVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => {
          setIsVideoModalOpen(false);
          setEditingVideo(null);
        }}
        onSave={handleSaveVideo}
        editingVideo={editingVideo}
        existingCities={[
          ...cities.map((c) => c.name),
          ...videos.map((v) => v.category).filter(Boolean)
        ]}
      />

      {/* Admin Authorization PIN Modal */}
      <AdminAuthModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => {
          setIsAdminAuthModalOpen(false);
          setPendingActionCallback(null);
          setPendingActionName(null);
        }}
        onAuthorizeSuccess={handleAuthorizeSuccess}
        currentPin={adminPin}
        onChangePin={handleChangePin}
        pendingActionName={pendingActionName}
      />

      {/* Backup and Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupRestoreModalOpen}
        onClose={() => setIsBackupRestoreModalOpen(false)}
        cities={cities}
        readings={readings}
        shelters={shelters}
        shelterReadings={shelterReadings}
        videos={videos}
        blockedRoads={blockedRoads}
        dataSources={dataSources}
        onRestoreData={handleRestoreBackup}
      />

    </div>
  );
}
