import React, { useState, useEffect, useMemo } from 'react';
import {
  Youtube,
  Play,
  Share2,
  Plus,
  Search,
  ExternalLink,
  Sparkles,
  Clock,
  Radio,
  Check,
  Trash2,
  Edit,
  Info,
  Maximize2,
  X,
  Layers,
  MapPin
} from 'lucide-react';
import { YouTubeVideo } from '../../types';
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../../utils/youtubeUtils';

interface VideosPageProps {
  videos: YouTubeVideo[];
  onOpenAddModal: () => void;
  onEditVideo: (video: YouTubeVideo) => void;
  onDeleteVideo: (videoId: string) => void;
  isAdminAuthorized: boolean;
  onOpenAdminAuth: () => void;
}

export const VideosPage: React.FC<VideosPageProps> = ({
  videos,
  onOpenAddModal,
  onEditVideo,
  onDeleteVideo,
  isAdminAuthorized
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVideo, setExpandedVideo] = useState<YouTubeVideo | null>(null);
  const [playingInlineVideoId, setPlayingInlineVideoId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dynamic categories: Only cities where there is actually at least 1 video registered, plus "Todos"
  const availableCategories = useMemo(() => {
    const categoryCounts = new Map<string, number>();

    videos.forEach((v) => {
      const cat = (v.category || '').trim();
      if (cat) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    });

    const uniqueCities = Array.from(categoryCounts.keys()).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    return {
      categories: ['Todos', ...uniqueCities],
      counts: categoryCounts
    };
  }, [videos]);

  // If the active filter city no longer has any registered videos, reset to 'Todos'
  useEffect(() => {
    if (
      selectedCategory !== 'Todos' &&
      !availableCategories.categories.includes(selectedCategory)
    ) {
      setSelectedCategory('Todos');
    }
  }, [availableCategories.categories, selectedCategory]);

  // Close expanded video modal when pressing the Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedVideo(null);
      }
    };

    if (expandedVideo) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedVideo]);

  // Filtered list
  const filteredVideos = videos.filter((video) => {
    let matchesCategory = false;
    if (selectedCategory === 'Todos') {
      matchesCategory = true;
    } else {
      const selected = selectedCategory.trim().toLowerCase();
      const videoCat = (video.category || '').trim().toLowerCase();
      matchesCategory = videoCat === selected;
    }

    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (video.category && video.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (video.author && video.author.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleCopyLink = (url: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-red-950/40 to-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-300 text-xs font-semibold">
              <Youtube className="w-3.5 h-3.5 text-red-400" />
              Galeria de Vídeos & Transmissões
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Vídeos e Transmissões do YouTube
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Explore miniaturas de transmissões ao vivo, boletins informativos da Defesa Civil e matérias sobre os rios do RS. Clique em qualquer miniatura ou no botão para assistir.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-2xl shadow-lg hover:shadow-red-900/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Compartilhar Vídeo
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Dynamic Category Tabs: ONLY cities with actual videos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
            {availableCategories.categories.map((cat) => {
              const count = cat === 'Todos' ? videos.length : (availableCategories.counts.get(cat) || 0);
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-full font-extrabold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar vídeos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </div>

        </div>
      </div>

      {/* Videos Grid Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
                <span>Vídeos Disponíveis</span>
                <span className="px-2.5 py-0.5 text-xs font-black bg-red-600 text-white rounded-full shadow-sm">
                  {filteredVideos.length}
                </span>
              </h3>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Transmissões e reportagens em tempo real ({selectedCategory === 'Todos' ? 'Todas as cidades' : `Filtrado por: ${selectedCategory}`})
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
            💡 Clique em &quot;Expandir com Som&quot; para assistir com áudio
          </div>
        </div>

        {filteredVideos.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-3">
            <Youtube className="w-10 h-10 mx-auto text-slate-400 opacity-50" />
            <p className="text-sm font-semibold">Nenhum vídeo encontrado para os filtros selecionados.</p>
            <button
              onClick={() => {
                setSelectedCategory('Todos');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVideos.map((video) => {
              return (
                <div
                  key={video.id}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl"
                >
                  {/* Card Thumbnail / Player Area - Auto-playing video embed */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    <iframe
                      src={getYouTubeEmbedUrl(video.youtubeId, true, true)}
                      title={video.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />

                    {/* Top Overlay Badges & Action */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                      {video.isFeatured ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold shadow-md flex items-center gap-1 pointer-events-auto">
                          <Sparkles className="w-3 h-3 fill-slate-950" /> Destaque
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900/80 text-red-400 text-[10px] font-bold border border-red-500/30 backdrop-blur-sm flex items-center gap-1 pointer-events-auto">
                          <Radio className="w-3 h-3 text-red-500 animate-pulse" /> Auto-executando
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedVideo(video)}
                        className="px-2.5 py-1 bg-slate-900/90 hover:bg-red-600 text-white text-[10px] font-extrabold rounded-lg backdrop-blur-sm flex items-center gap-1 transition-colors shadow-md cursor-pointer pointer-events-auto"
                        title="Expandir Vídeo com áudio"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Expandir com Som</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900/40">
                          {video.category}
                        </span>
                        {video.author && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                            {video.author}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        {video.title}
                      </h4>

                      {video.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={() => setExpandedVideo(video)}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-red-600 dark:text-red-400 hover:text-red-500 cursor-pointer bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 transition-colors active:scale-95"
                        title="Expandir vídeo com som habilitado"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expandir Vídeo
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(video.youtubeUrl, video.id, e)}
                          title="Copiar Link"
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedId === video.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditVideo(video)}
                          title="Editar vídeo (Requer operador)"
                          className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (expandedVideo?.id === video.id) {
                              setExpandedVideo(null);
                            }
                            if (playingInlineVideoId === video.id) {
                              setPlayingInlineVideoId(null);
                            }
                            onDeleteVideo(video.id);
                          }}
                          title="Excluir vídeo"
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Lightbox Modal Player */}
      {expandedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Lightbox Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-red-600/20 text-red-400 rounded-xl border border-red-500/30">
                  <Radio className="w-4 h-4 animate-pulse" />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">
                    {expandedVideo.category}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1">
                    {expandedVideo.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyLink(expandedVideo.youtubeUrl, expandedVideo.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedId === expandedVideo.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-slate-400" /> Compartilhar Link
                    </>
                  )}
                </button>

                <a
                  href={expandedVideo.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-semibold rounded-xl border border-red-500/40 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir no YouTube
                </a>

                <button
                  type="button"
                  onClick={() => onEditVideo(expandedVideo)}
                  title="Editar Vídeo"
                  className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = expandedVideo.id;
                    setExpandedVideo(null);
                    onDeleteVideo(idToDelete);
                  }}
                  title="Excluir Vídeo"
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setExpandedVideo(null)}
                  title="Fechar (ESC)"
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer ml-1 flex items-center gap-1"
                >
                  <X className="w-5 h-5" />
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 rounded">ESC</kbd>
                </button>
              </div>
            </div>

            {/* Lightbox Video Player */}
            <div className="relative w-full bg-black aspect-video max-h-[560px]">
              <iframe
                src={getYouTubeEmbedUrl(expandedVideo.youtubeId, true, false)}
                title={expandedVideo.title}
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {/* Lightbox Footer Info */}
            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto bg-slate-900 text-slate-300">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {expandedVideo.author && (
                  <span className="font-semibold text-white bg-slate-800 px-3 py-1 rounded-lg">
                    Fonte: {expandedVideo.author}
                  </span>
                )}
                <span className="text-slate-400 flex items-center gap-1 ml-auto">
                  <Clock className="w-3.5 h-3.5" />
                  Publicado em {new Date(expandedVideo.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              {expandedVideo.description && (
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-800/50 p-4 rounded-2xl border border-slate-800">
                  {expandedVideo.description}
                </p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Community Info Box */}
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-300">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/20 text-red-400 rounded-xl border border-red-500/30">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Tem um vídeo ou transmissão ao vivo para compartilhar?</p>
            <p className="text-[11px] text-slate-400">
              Incentivamos o compartilhamento de canais comunitários e matérias úteis para a população do RS.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
        >
          Enviar Vídeo do YouTube
        </button>
      </div>

    </div>
  );
};
