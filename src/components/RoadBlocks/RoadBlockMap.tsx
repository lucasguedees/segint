import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, LocateFixed, Layers, Search, X, AlertOctagon, AlertTriangle, CheckCircle2, MapPin, Filter } from 'lucide-react';
import { BlockedRoad } from '../../types';

// Safeguard Leaflet against detached DOM elements during React component unmounts
if (typeof window !== 'undefined' && L && L.DomUtil) {
  const origGetPosition = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: HTMLElement) {
    if (!el) return new L.Point(0, 0);
    try {
      return origGetPosition.call(L.DomUtil, el) || new L.Point(0, 0);
    } catch (e) {
      return new L.Point(0, 0);
    }
  };
}

interface RoadBlockMapProps {
  blockedRoads: BlockedRoad[];
  selectedRoadId?: string | null;
  onSelectRoad?: (road: BlockedRoad) => void;
  isPicker?: boolean;
  pickerLat?: number;
  pickerLng?: number;
  onPickLocation?: (lat: number, lng: number) => void;
  height?: string;
}

// Function to create SVG colored Leaflet DivIcons
function createMarkerIcon(status: 'total' | 'parcial' | 'liberado', isSelected: boolean) {
  let bgColor = '#ef4444'; // Red
  let badgeText = '⛔';

  if (status === 'parcial') {
    bgColor = '#f59e0b'; // Amber / Orange
    badgeText = '⚠️';
  } else if (status === 'liberado') {
    bgColor = '#10b981'; // Emerald / Green
    badgeText = '✅';
  }

  const scale = isSelected ? 'scale(1.3)' : 'scale(1.0)';
  const pulse = isSelected ? 'box-shadow: 0 0 20px rgba(239,68,68,0.9);' : '';

  const html = `
    <div style="
      transform: ${scale};
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${bgColor};
      border: 3px solid #ffffff;
      box-shadow: 0 6px 16px rgba(0,0,0,0.6);
      cursor: pointer;
      font-size: 20px;
      ${pulse}
    ">
      <span>${badgeText}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-roadblock-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

function createPickerIcon() {
  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #06b6d4;
      border: 3.5px solid #ffffff;
      box-shadow: 0 0 20px rgba(6,182,212,0.9);
      font-size: 24px;
      cursor: move;
    ">
      📍
    </div>
  `;

  return L.divIcon({
    html,
    className: 'picker-roadblock-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function buildPopupContent(road: BlockedRoad) {
  let statusBadge = '<span style="background:#ef4444; color:#fff; padding:3px 9px; border-radius:9999px; font-weight:bold; font-size:11px; display:inline-block;">⛔ Interdição Total</span>';
  if (road.status === 'parcial') {
    statusBadge = '<span style="background:#f59e0b; color:#fff; padding:3px 9px; border-radius:9999px; font-weight:bold; font-size:11px; display:inline-block;">⚠️ Trânsito Parcial</span>';
  } else if (road.status === 'liberado') {
    statusBadge = '<span style="background:#10b981; color:#fff; padding:3px 9px; border-radius:9999px; font-weight:bold; font-size:11px; display:inline-block;">✅ Via Liberada</span>';
  }

  const imgHtml = road.imageUrl
    ? `<img src="${road.imageUrl}" alt="${road.locationName}" style="width:100%; height:110px; object-fit:cover; border-radius:10px; margin-bottom:10px;" />`
    : '';

  return `
    <div style="width:260px; font-family:sans-serif; text-align:left;">
      ${imgHtml}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
        <span style="font-size:11px; font-weight:800; color:#38bdf8; text-transform:uppercase;">📍 ${road.cityName}</span>
        ${statusBadge}
      </div>
      <h4 style="font-size:14px; font-weight:800; color:#f8fafc; margin:0 0 6px 0; line-height:1.3;">
        ${road.locationName}
      </h4>
      <p style="font-size:12px; color:#cbd5e1; margin:0 0 8px 0; line-height:1.4;">
        <strong style="color:#94a3b8;">Motivo:</strong> ${road.reason}
      </p>
      ${
        road.expectedRelease
          ? `<div style="font-size:11px; color:#94a3b8; margin-bottom:10px; background:#1e293b; padding:6px 8px; border-radius:6px;">
               ⏱️ <strong style="color:#e2e8f0;">Previsão:</strong> ${road.expectedRelease}
             </div>`
          : ''
      }
      <button
        id="btn-select-road-${road.id}"
        style="width:100%; padding:8px 12px; background:linear-gradient(to right, #0284c7, #0d9488); color:#ffffff; font-weight:bold; font-size:12px; border:none; border-radius:8px; cursor:pointer; text-align:center;"
      >
        Ver Detalhes da Via &rarr;
      </button>
    </div>
  `;
}

export const RoadBlockMap: React.FC<RoadBlockMapProps> = ({
  blockedRoads,
  selectedRoadId,
  onSelectRoad,
  isPicker = false,
  pickerLat = -29.4678,
  pickerLng = -51.9582,
  onPickLocation,
  height = '460px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [tileStyle, setTileStyle] = useState<'voyager' | 'dark'>('voyager');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'total' | 'parcial' | 'liberado'>('all');
  const [isMapReady, setIsMapReady] = useState(false);

  // Default center: Vale do Taquari (Lajeado/Estrela/Arroio do Meio region)
  const defaultCenter: [number, number] = [-29.45, -51.95];
  const defaultZoom = 11;

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: isPicker ? [pickerLat, pickerLng] : defaultCenter,
        zoom: defaultZoom,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tile layer setup
      const getTileUrl = (style: 'voyager' | 'dark') => {
        if (style === 'dark') {
          return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        }
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      };

      const tileLayer = L.tileLayer(getTileUrl(tileStyle), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
      setIsMapReady(true);

      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
          } catch (e) {}
        }
      }, 100);

      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
          } catch (e) {}
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        clearTimeout(timer);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        // Safely remove markers first
        Object.keys(markersRef.current).forEach((id) => {
          try {
            markersRef.current[id].closePopup();
            markersRef.current[id].remove();
          } catch (e) {}
        });
        markersRef.current = {};

        if (pickerMarkerRef.current) {
          try {
            pickerMarkerRef.current.closePopup();
            pickerMarkerRef.current.remove();
          } catch (e) {}
          pickerMarkerRef.current = null;
        }

        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.stop();
            mapInstanceRef.current.off();
            mapInstanceRef.current.remove();
          } catch (e) {}
          mapInstanceRef.current = null;
          setIsMapReady(false);
        }
      };
    }
  }, []);

  // Invalidate size and refit bounds whenever full-screen is toggled
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 50);

    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        handleFitBounds();
      }
    }, 200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isExpanded]);

  // Update tile style when user switches layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    let url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    if (tileStyle === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
    tileLayerRef.current.setUrl(url);
  }, [tileStyle]);

  // Handle map click for picker mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isPicker) {
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (onPickLocation) {
          onPickLocation(lat, lng);
        }
      };

      map.on('click', handleMapClick);

      if (!pickerMarkerRef.current) {
        pickerMarkerRef.current = L.marker([pickerLat, pickerLng], {
          icon: createPickerIcon(),
          draggable: true,
        }).addTo(map);

        pickerMarkerRef.current.on('dragend', () => {
          if (pickerMarkerRef.current && onPickLocation) {
            const pos = pickerMarkerRef.current.getLatLng();
            onPickLocation(pos.lat, pos.lng);
          }
        });
      } else {
        pickerMarkerRef.current.setLatLng([pickerLat, pickerLng]);
      }

      return () => {
        try {
          map.off('click', handleMapClick);
          if (pickerMarkerRef.current) {
            pickerMarkerRef.current.remove();
            pickerMarkerRef.current = null;
          }
        } catch (e) {}
      };
    } else {
      if (pickerMarkerRef.current) {
        try {
          pickerMarkerRef.current.remove();
        } catch (e) {}
        pickerMarkerRef.current = null;
      }
    }
  }, [isPicker, pickerLat, pickerLng, onPickLocation]);

  // Update markers when blockedRoads change or selectedRoadId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapReady || isPicker) return;

    // Filter roads based on search & status filter for full screen or default map
    const filteredRoads = blockedRoads.filter((road) => {
      const matchesSearch =
        searchQuery === '' ||
        road.cityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        road.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        road.reason.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || road.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Remove old markers that no longer exist in current filter
    Object.keys(markersRef.current).forEach((id) => {
      if (!filteredRoads.some((r) => r.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add / Update markers
    filteredRoads.forEach((road) => {
      const isSelected = road.id === selectedRoadId;
      const icon = createMarkerIcon(road.status, isSelected);

      if (markersRef.current[road.id]) {
        markersRef.current[road.id].setLatLng([road.latitude, road.longitude]);
        markersRef.current[road.id].setIcon(icon);
        markersRef.current[road.id].setPopupContent(buildPopupContent(road));
      } else {
        const marker = L.marker([road.latitude, road.longitude], { icon }).addTo(map);

        // Bind popup
        marker.bindPopup(buildPopupContent(road));

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-select-road-${road.id}`);
          if (btn) {
            btn.onclick = () => {
              if (onSelectRoad) onSelectRoad(road);
            };
          }
        });

        marker.on('click', () => {
          if (onSelectRoad) {
            onSelectRoad(road);
          }
        });

        markersRef.current[road.id] = marker;
      }
    });

    // Pan map to selected road
    if (selectedRoadId && markersRef.current[selectedRoadId]) {
      const selectedRoad = blockedRoads.find((r) => r.id === selectedRoadId);
      if (selectedRoad) {
        map.panTo([selectedRoad.latitude, selectedRoad.longitude], {
          animate: true,
          duration: 0.8,
        });
        markersRef.current[selectedRoadId].openPopup();
      }
    }
  }, [blockedRoads, selectedRoadId, onSelectRoad, isPicker, searchQuery, statusFilter, isMapReady]);

  // Fit bounds helper
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || blockedRoads.length === 0) return;

    const bounds = L.latLngBounds(blockedRoads.map((r) => [r.latitude, r.longitude]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  };

  // Center on map initially if roads exist
  useEffect(() => {
    if (isMapReady && !isPicker && blockedRoads.length > 0) {
      setTimeout(() => {
        handleFitBounds();
      }, 300);
    }
  }, [isMapReady, blockedRoads.length, isPicker]);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        handleFitBounds();
      }
    }, 200);
  };

  // Counts for legend
  const totalBlocked = blockedRoads.filter((r) => r.status === 'total').length;
  const partialBlocked = blockedRoads.filter((r) => r.status === 'parcial').length;
  const released = blockedRoads.filter((r) => r.status === 'liberado').length;

  return (
    <div
      className={
        isExpanded
          ? "fixed inset-0 z-[60] bg-slate-950 flex flex-col p-2 md:p-4 overflow-hidden animate-in fade-in duration-200"
          : "relative isolate z-10 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950"
      }
    >
      {/* 1. TOP HEADER CONTROLS (FULLSCREEN VS EMBEDDED) */}
      {isExpanded ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 md:p-4 mb-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Mapa Completo de Vias Interditadas - Vale do Taquari
              </h3>
              <p className="text-xs text-slate-400">
                Visualização geográfica em tela cheia das condições das rodovias e ruas
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Todas ({blockedRoads.length})
            </button>
            <button
              onClick={() => setStatusFilter('total')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'total'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              ⛔ Total ({totalBlocked})
            </button>
            <button
              onClick={() => setStatusFilter('parcial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'parcial'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              ⚠️ Parcial ({partialBlocked})
            </button>
            <button
              onClick={() => setStatusFilter('liberado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'liberado'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              ✅ Liberadas ({released})
            </button>
          </div>

          {/* Close & Fit Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFitBounds}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              <LocateFixed className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Ajustar Visão</span>
            </button>

            <button
              onClick={handleToggleExpand}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-red-900/80 border border-slate-700 text-white text-xs font-extrabold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <Minimize2 className="w-4 h-4 text-slate-300" />
              <span>Fechar Tela Cheia</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          {/* Status Counts Pill */}
          <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-xl backdrop-blur-md text-xs font-semibold">
            <span className="text-slate-300 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
              <strong className="text-red-400 font-extrabold">{totalBlocked}</strong> Total
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <strong className="text-amber-400 font-extrabold">{partialBlocked}</strong> Parcial
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <strong className="text-emerald-400 font-extrabold">{released}</strong> Liberadas
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFitBounds}
              title="Centralizar todas as vias no mapa"
              className="inline-flex items-center gap-1.5 bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg transition-all cursor-pointer backdrop-blur-md active:scale-95"
            >
              <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Ajustar Visão</span>
            </button>

            <button
              onClick={handleToggleExpand}
              title="Expandir mapa em tela cheia"
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-lg transition-all cursor-pointer backdrop-blur-md active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Extender Mapa</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. MAP MAIN BODY CONTAINER */}
      <div
        className="flex-1 relative w-full overflow-hidden flex flex-col min-h-0 rounded-2xl"
        style={{ height: isExpanded ? '100%' : height }}
      >
        {/* THE SINGLE LEAFLET MAP DIV */}
        <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" style={{ minHeight: isExpanded ? '0' : height }} />

        {/* Tile Layer Selector (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-lg backdrop-blur-md">
          <button
            onClick={() => setTileStyle('voyager')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              tileStyle === 'voyager' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Padrão
          </button>
          <button
            onClick={() => setTileStyle('dark')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              tileStyle === 'dark' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Escuro
          </button>
        </div>

        {/* Picker Mode Banner */}
        {isPicker && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-cyan-950/90 border border-cyan-500/80 text-cyan-200 text-xs px-4 py-2 rounded-2xl shadow-xl z-20 font-semibold flex items-center gap-2 backdrop-blur-md animate-pulse">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>Clique ou arraste o marcador azul no mapa para definir a posição da via</span>
          </div>
        )}
      </div>
    </div>
  );
};
