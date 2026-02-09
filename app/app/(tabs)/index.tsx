import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
} from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";

type Episode = {
  id: string;
  title: string;
  description?: string;
  isPublished: boolean;
  startSceneId: string;
  sortOrder?: number;
};

type EpisodeProgress = {
  episodeId: string;
  currentSceneId?: string;
  isCompleted?: boolean;
  completedAt?: any;
  updatedAt?: any;
};

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [progressByEpisodeId, setProgressByEpisodeId] = useState<
    Record<string, EpisodeProgress>
  >({});

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Load published episodes
  useEffect(() => {
    const q = query(
      collection(db, "episodes"),
      where("isPublished", "==", true),
      orderBy("sortOrder", "asc"),
    );

    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setEpisodes(items);
      },
      (err) => {
        console.error("Episodes query failed:", err);
      },
    );
  }, []);

  // Subscribe to progress docs for each episode (only when signed in)
  useEffect(() => {
    if (!user?.uid) {
      setProgressByEpisodeId({});
      return;
    }
    if (episodes.length === 0) {
      setProgressByEpisodeId({});
      return;
    }

    const unsubscribers = episodes.map((ep) => {
      const progressRef = doc(db, "progress", user.uid, "episodes", ep.id);
      return onSnapshot(progressRef, (snap) => {
        setProgressByEpisodeId((prev) => {
          const next = { ...prev };
          if (snap.exists()) {
            next[ep.id] = snap.data() as EpisodeProgress;
          } else {
            delete next[ep.id];
          }
          return next;
        });
      });
    });

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [user?.uid, episodes]);

  const header = useMemo(() => {
    return (
      <View style={{ gap: 10, padding: 16 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>
          PuzzlePass
        </Text>

        {user ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: "white" }}>Signed in:</Text>
            <Text style={{ color: "white" }} selectable>
              {user.uid}
            </Text>

            <Pressable
              onPress={() => signOut(auth)}
              style={{ padding: 10, borderRadius: 10, backgroundColor: "#222" }}
            >
              <Text style={{ color: "white" }}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => signInAnonymously(auth)}
            style={{ padding: 10, borderRadius: 10, backgroundColor: "#222" }}
          >
            <Text style={{ color: "white" }}>Quick sign-in (anonymous)</Text>
          </Pressable>
        )}

        <Text
          style={{
            color: "white",
            marginTop: 8,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          Episodes
        </Text>

        <Text style={{ color: "#aaa" }}>
          Tap an episode to start. Progress is saved automatically.
        </Text>
      </View>
    );
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const progress = progressByEpisodeId[item.id];
          const isCompleted = progress?.isCompleted === true;

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/episode/[episodeId]" as any,
                  params: { episodeId: item.id },
                })
              }
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#111",
                borderWidth: 1,
                borderColor: "#222",
                gap: 6,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text
                  style={{ color: "white", fontSize: 16, fontWeight: "700" }}
                >
                  {item.title}
                </Text>

                {isCompleted ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: "#173d22",
                      borderWidth: 1,
                      borderColor: "#2f7a44",
                    }}
                  >
                    <Text style={{ color: "#7CFC90", fontWeight: "700" }}>
                      Completed
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.description ? (
                <Text style={{ color: "#bbb" }}>{item.description}</Text>
              ) : null}

              <Text style={{ color: "#888" }}>
                {isCompleted
                  ? "Tap to replay"
                  : progress?.currentSceneId
                    ? "Tap to continue"
                    : "Tap to play"}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
