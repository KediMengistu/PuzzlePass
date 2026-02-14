import type { RootState } from "@/store";
import type { Episode } from "@/store/types";

export const selectAuthState = (state: RootState) => state.auth;
export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;

export const selectEpisodesState = (state: RootState) => state.episodes;
export const selectEpisodes = (state: RootState) => state.episodes.items;
export const selectEpisodeById = (state: RootState, episodeId: string) =>
  state.episodes.items.find((episode) => episode.id === episodeId) ?? null;

export const selectEntitlementsState = (state: RootState) => state.entitlements;
export const selectEntitlement = (state: RootState) => state.entitlements.value;

export const selectProgressState = (state: RootState) => state.progress;
export const selectProgressByEpisodeId = (state: RootState) =>
  state.progress.byEpisodeId;
export const selectEpisodeProgress = (state: RootState, episodeId: string) =>
  state.progress.byEpisodeId[episodeId] ?? null;

export const selectCheckoutState = (state: RootState) => state.checkout;
export const selectEpisodeRunnerState = (state: RootState) => state.episodeRunner;
export const selectEpisodeRunnerEntry = (state: RootState, episodeId: string) =>
  state.episodeRunner.byEpisodeId[episodeId] ?? null;

export function canAccessEpisode(episode: Episode, state: RootState) {
  if (episode.isFreePreview === true) return true;

  const entitlement = state.entitlements.value;
  if (!entitlement) return false;
  if (entitlement.isSubscriber === true) return true;

  const unlocked = entitlement.unlockedEpisodeIds ?? [];
  return unlocked.includes(episode.id);
}
