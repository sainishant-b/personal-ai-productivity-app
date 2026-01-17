// Cache management for AI recommendations
// Only fetches when: new task added, task completed, or once daily at night

const CACHE_KEY = 'ai_recommendations_cache';
const LAST_FETCH_KEY = 'ai_recommendations_last_fetch';
const INVALIDATION_KEY = 'ai_recommendations_invalidated';

interface CachedRecommendations {
  data: any;
  timestamp: number;
}

// Get cached recommendations
export function getCachedRecommendations(): CachedRecommendations | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error reading recommendations cache:', e);
  }
  return null;
}

// Save recommendations to cache
export function cacheRecommendations(data: any): void {
  try {
    const cache: CachedRecommendations = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
    localStorage.removeItem(INVALIDATION_KEY); // Clear invalidation flag
  } catch (e) {
    console.error('Error caching recommendations:', e);
  }
}

// Mark recommendations as needing refresh
export function invalidateRecommendations(): void {
  localStorage.setItem(INVALIDATION_KEY, 'true');
}

// Check if recommendations need to be refreshed
export function shouldRefreshRecommendations(): boolean {
  // Check if explicitly invalidated (task added/completed)
  const isInvalidated = localStorage.getItem(INVALIDATION_KEY) === 'true';
  if (isInvalidated) {
    return true;
  }

  // Check if no cache exists
  const cached = getCachedRecommendations();
  if (!cached) {
    return true;
  }

  // Check if cache is from a different day (daily refresh)
  const lastFetch = parseInt(localStorage.getItem(LAST_FETCH_KEY) || '0', 10);
  if (lastFetch === 0) {
    return true;
  }

  const lastFetchDate = new Date(lastFetch);
  const now = new Date();
  
  // Different day = needs refresh
  if (lastFetchDate.toDateString() !== now.toDateString()) {
    return true;
  }

  // Check if it's evening (after 8 PM) and last fetch was before 8 PM today
  const eveningHour = 20; // 8 PM
  if (now.getHours() >= eveningHour) {
    const lastFetchHour = lastFetchDate.getHours();
    if (lastFetchHour < eveningHour) {
      return true; // Refresh in the evening for next day planning
    }
  }

  return false;
}

// Clear all recommendation cache
export function clearRecommendationCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(LAST_FETCH_KEY);
  localStorage.removeItem(INVALIDATION_KEY);
}

// Get time until next scheduled refresh (for display purposes)
export function getNextRefreshTime(): Date {
  const now = new Date();
  const eveningHour = 20; // 8 PM
  
  if (now.getHours() >= eveningHour) {
    // Next refresh is tomorrow morning
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  } else {
    // Next refresh is tonight at 8 PM
    const tonight = new Date(now);
    tonight.setHours(eveningHour, 0, 0, 0);
    return tonight;
  }
}
