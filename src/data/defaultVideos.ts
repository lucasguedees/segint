import { YouTubeVideo } from '../types';

export const DEFAULT_VIDEOS: YouTubeVideo[] = [];

export function mergeWithDefaultVideos(incoming: YouTubeVideo[]): YouTubeVideo[] {
  return Array.isArray(incoming) ? incoming : [];
}
