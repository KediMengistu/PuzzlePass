export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export type Episode = {
  id: string;
  title: string;
  description?: string;
  isPublished: boolean;
  startSceneId: string;
  sortOrder?: number;
  isFreePreview?: boolean;
  stripePriceId?: string;
};

export type Entitlement = {
  unlockedEpisodeIds?: string[];
  isSubscriber?: boolean;
  stripeCustomerId?: string | null;
  updatedAt?: unknown;
};

export type EpisodeProgress = {
  episodeId: string;
  currentSceneId?: string;
  completedSceneIds?: string[];
  isCompleted?: boolean;
  completedAt?: unknown;
  updatedAt?: unknown;
};
