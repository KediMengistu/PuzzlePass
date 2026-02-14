import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Platform } from "react-native";
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
import { httpsCallable } from "firebase/functions";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { auth, db, functions } from "../../firebase/firebase";

type Episode = {
  id: string;
  title: string;
  description?: string;
  isPublished: boolean;
  startSceneId: string;
  sortOrder?: number;

  isFreePreview?: boolean;
  stripePriceId?: string;
};

type EpisodeProgress = {
  episodeId: string;
  currentSceneId?: string;
  isCompleted?: boolean;
  completedAt?: any;
  updatedAt?: any;
};

type Entitlement = {
  unlockedEpisodeIds?: string[];
  isSubscriber?: boolean;
  updatedAt?: any;
};

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [progressByEpisodeId, setProgressByEpisodeId] = useState<
    Record<string, EpisodeProgress>
  >({});

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  const [buyingEpisodeId, setBuyingEpisodeId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string>("");
  const [purchaseStatus, setPurchaseStatus] = useState<string>("");

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

  // Subscribe to entitlements/{uid}
  useEffect(() => {
    if (!user?.uid) {
      setEntitlement(null);
      return;
    }

    const entRef = doc(db, "entitlements", user.uid);
    return onSnapshot(
      entRef,
      (snap) => {
        setEntitlement(snap.exists() ? (snap.data() as Entitlement) : null);
      },
      (err) => {
        console.error("Entitlements subscribe failed:", err);
      },
    );
  }, [user?.uid]);

  const canAccessEpisode = (ep: Episode) => {
    if (ep.isFreePreview === true) return true;
    if (entitlement?.isSubscriber === true) return true;

    const unlocked = entitlement?.unlockedEpisodeIds ?? [];
    return unlocked.includes(ep.id);
  };

  // Subscribe to progress docs
  useEffect(() => {
    if (!user?.uid || episodes.length === 0) {
      setProgressByEpisodeId({});
      return;
    }

    const unsubscribers = episodes.map((ep) => {
      const progressRef = doc(db, "progress", user.uid, "episodes", ep.id);
      return onSnapshot(progressRef, (snap) => {
        setProgressByEpisodeId((prev) => {
          const next = { ...prev };
          if (snap.exists()) next[ep.id] = snap.data() as EpisodeProgress;
          else delete next[ep.id];
          return next;
        });
      });
    });

    return () => unsubscribers.forEach((u) => u());
  }, [user?.uid, episodes]);

  const startCheckout = async (episodeId: string) => {
    setBuyError("");
    setPurchaseStatus("");

    if (!user?.uid) {
      setBuyError("Please sign in first.");
      return;
    }

    setBuyingEpisodeId(episodeId);

    try {
      // Return base is the same concept across platforms:
      // - Web:  http://localhost:8081/purchase (or deployed domain)
      // - iOS/Android dev build: puzzlepass://purchase
      // - Expo Go: exp://.../purchase (scheme needs to be allowed in Functions)
      const returnBase = Linking.createURL("purchase");
      const successUrl = `${returnBase}?purchase=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${returnBase}?purchase=cancel`;

      const fn = httpsCallable(functions, "createCheckoutSession");
      const res = await fn({ episodeId, successUrl, cancelUrl });
      const data = res.data as any;
      const url = data?.url as string | undefined;

      if (!url) throw new Error("Missing checkout url.");

      if (Platform.OS === "web") {
        window.location.assign(url);
      } else {
        // Open checkout and listen for redirect back to returnBase
        const result = await WebBrowser.openAuthSessionAsync(url, returnBase);

        if (result.type === "success" && result.url) {
          const parsed = Linking.parse(result.url);
          router.replace({
            pathname: "/purchase" as any,
            params: (parsed.queryParams ?? {}) as any,
          });
        } else {
          setPurchaseStatus("Purchase cancelled.");
        }
      }
    } catch (e: any) {
      const msg =
        e?.code && e?.message
          ? `${e.code}: ${e.message}`
          : (e?.message ?? String(e));
      setBuyError(msg);
    } finally {
      setBuyingEpisodeId(null);
    }
  };

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

            <Text style={{ color: "#888" }}>
              Entitled episodes:{" "}
              {(entitlement?.unlockedEpisodeIds ?? []).join(", ") || "—"}
            </Text>

            {purchaseStatus ? (
              <Text style={{ color: "#9ad1ff" }}>{purchaseStatus}</Text>
            ) : null}

            {buyError ? (
              <Text style={{ color: "#ff8f8f" }}>{buyError}</Text>
            ) : null}
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
          Free episodes are playable. Paid episodes require entitlement.
        </Text>
      </View>
    );
  }, [user, entitlement, buyError, purchaseStatus]);

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

          const unlocked = canAccessEpisode(item);
          const isFree = item.isFreePreview === true;

          return (
            <Pressable
              disabled={!unlocked}
              onPress={() => {
                if (!unlocked) return;
                router.push({
                  pathname: "/episode/[episodeId]" as any,
                  params: { episodeId: item.id },
                });
              }}
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                padding: 14,
                borderRadius: 14,
                backgroundColor: unlocked ? "#111" : "#0d0d0d",
                borderWidth: 1,
                borderColor: unlocked ? "#222" : "#2a1b1b",
                gap: 6,
                opacity: unlocked ? 1 : 0.9,
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

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: isFree ? "#173d22" : "#222",
                      borderWidth: 1,
                      borderColor: isFree ? "#2f7a44" : "#333",
                    }}
                  >
                    <Text
                      style={{
                        color: isFree ? "#7CFC90" : "white",
                        fontWeight: "700",
                      }}
                    >
                      {isFree ? "FREE" : "PAID"}
                    </Text>
                  </View>

                  {!unlocked ? (
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: "#2a1b1b",
                        borderWidth: 1,
                        borderColor: "#7a2f2f",
                      }}
                    >
                      <Text style={{ color: "#ff8f8f", fontWeight: "700" }}>
                        🔒 Locked
                      </Text>
                    </View>
                  ) : null}

                  {unlocked && isCompleted ? (
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
              </View>

              {item.description ? (
                <Text style={{ color: "#bbb" }}>{item.description}</Text>
              ) : null}

              <Text style={{ color: "#888" }}>
                {!unlocked
                  ? "Locked — purchase required"
                  : isCompleted
                    ? "Tap to replay"
                    : progress?.currentSceneId
                      ? "Tap to continue"
                      : "Tap to play"}
              </Text>

              {!unlocked ? (
                <Pressable
                  disabled={buyingEpisodeId === item.id}
                  onPress={() => startCheckout(item.id)}
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: "#222",
                    borderWidth: 1,
                    borderColor: "#444",
                    opacity: buyingEpisodeId === item.id ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    {buyingEpisodeId === item.id ? "Opening checkout…" : "Buy"}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
