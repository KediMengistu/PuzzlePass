import { useEffect, useMemo } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  entitlementsCleared,
  entitlementsFailed,
  entitlementsLoading,
  entitlementsReceived,
} from "@/store/slices/entitlements-slice";
import {
  episodesFailed,
  episodesLoading,
  episodesReceived,
} from "@/store/slices/episodes-slice";
import {
  progressCleared,
  progressEpisodeRemoved,
  progressEpisodeUpserted,
  progressFailed,
  progressLoading,
} from "@/store/slices/progress-slice";
import type { Entitlement, Episode, EpisodeProgress } from "@/store/types";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function useEpisodesBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(episodesLoading());

    const episodesQuery = query(
      collection(db, "episodes"),
      where("isPublished", "==", true),
      orderBy("sortOrder", "asc"),
    );

    return onSnapshot(
      episodesQuery,
      (snapshot) => {
        const items: Episode[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Episode, "id">),
        }));

        dispatch(episodesReceived(items));
      },
      (error) => {
        dispatch(episodesFailed(toErrorMessage(error)));
      },
    );
  }, [dispatch]);
}

function useEntitlementsBootstrap() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((state) => state.auth.user?.uid ?? null);

  useEffect(() => {
    if (!uid) {
      dispatch(entitlementsCleared());
      return;
    }

    dispatch(entitlementsLoading());

    const entitlementRef = doc(db, "entitlements", uid);
    return onSnapshot(
      entitlementRef,
      (snapshot) => {
        const value = snapshot.exists()
          ? (snapshot.data() as Entitlement)
          : null;
        dispatch(entitlementsReceived(value));
      },
      (error) => {
        dispatch(entitlementsFailed(toErrorMessage(error)));
      },
    );
  }, [dispatch, uid]);
}

function useProgressBootstrap() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((state) => state.auth.user?.uid ?? null);
  const episodes = useAppSelector((state) => state.episodes.items);

  const episodeIds = useMemo(() => episodes.map((episode) => episode.id), [episodes]);

  useEffect(() => {
    if (!uid || episodeIds.length === 0) {
      dispatch(progressCleared());
      return;
    }

    dispatch(progressLoading());

    const unsubscribers = episodeIds.map((episodeId) => {
      const progressRef = doc(db, "progress", uid, "episodes", episodeId);

      return onSnapshot(
        progressRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            dispatch(progressEpisodeRemoved(episodeId));
            return;
          }

          const progress = {
            ...(snapshot.data() as Omit<EpisodeProgress, "episodeId">),
            episodeId,
          } satisfies EpisodeProgress;

          dispatch(progressEpisodeUpserted(progress));
        },
        (error) => {
          dispatch(progressFailed(toErrorMessage(error)));
        },
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [dispatch, episodeIds, uid]);
}

export function useStoreBootstrap() {
  useEpisodesBootstrap();
  useEntitlementsBootstrap();
  useProgressBootstrap();
}
