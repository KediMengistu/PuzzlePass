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

export type SceneOption = {
  id: string;
  label: string;
};

export type SceneBase = {
  title: string;
  nextSceneId?: string;
};

export type StoryScene = SceneBase & {
  type: "story";
  body: string;
};

export type CodeEntryScene = SceneBase & {
  type: "code_entry";
  prompt: string;
};

export type ChoiceScene = SceneBase & {
  type: "choice";
  prompt: string;
  options: SceneOption[];
};

export type Scene = StoryScene | CodeEntryScene | ChoiceScene;

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
