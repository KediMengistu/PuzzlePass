import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { signInWithGoogle, signOutCurrentUser } from "@/firebase/auth-helpers";
import { useCreateCheckoutSessionMutation } from "@/store/api/puzzle-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAuthUser,
  selectCheckoutState,
  selectEntitlement,
  selectEpisodes,
  selectEpisodesState,
  selectProgressByEpisodeId,
} from "@/store/selectors";
import {
  checkoutFlowReset,
  checkoutRedirectCancelled,
  checkoutRedirectStarted,
} from "@/store/slices/checkout-slice";
import type { Entitlement, Episode } from "@/store/types";

function formatError(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string };
    if (e.code && e.message) return `${e.code}: ${e.message}`;
    if (e.message) return e.message;
  }
  return "Request failed.";
}

function hasAccess(entitlement: Entitlement | null, episode: Episode) {
  if (episode.isFreePreview === true) return true;
  if (entitlement?.isSubscriber === true) return true;
  return (entitlement?.unlockedEpisodeIds ?? []).includes(episode.id);
}

export default function Index() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const user = useAppSelector(selectAuthUser);
  const episodes = useAppSelector(selectEpisodes);
  const episodesState = useAppSelector(selectEpisodesState);
  const entitlement = useAppSelector(selectEntitlement);
  const progressByEpisodeId = useAppSelector(selectProgressByEpisodeId);
  const checkout = useAppSelector(selectCheckoutState);

  const [createCheckoutSession] = useCreateCheckoutSessionMutation();

  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const buyingEpisodeId =
    checkout.createSession.status === "loading"
      ? checkout.createSession.episodeId
      : null;

  const purchaseStatus =
    checkout.redirectStatus === "cancelled" ? "Purchase cancelled." : null;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthMessage(null);

    try {
      const result = await signInWithGoogle();
      if (result === "redirecting") {
        setAuthMessage("Redirecting to Google sign-in...");
      }
    } catch (error) {
      setAuthMessage(formatError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const startCheckout = async (episodeId: string) => {
    if (!user?.uid) {
      setAuthMessage("Sign in to start checkout.");
      return;
    }

    dispatch(checkoutFlowReset());
    dispatch(checkoutRedirectStarted());

    try {
      const returnBase = Linking.createURL("purchase");
      const successUrl = `${returnBase}?purchase=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${returnBase}?purchase=cancel`;

      const session = await createCheckoutSession({
        episodeId,
        successUrl,
        cancelUrl,
      }).unwrap();

      if (Platform.OS === "web") {
        window.location.assign(session.url);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(session.url, returnBase);

      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        router.replace({
          pathname: "/purchase" as any,
          params: (parsed.queryParams ?? {}) as any,
        });
      } else {
        dispatch(checkoutRedirectCancelled());
      }
    } catch {
      // createSession errors are reflected via checkout slice + RTK Query state
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
              onPress={() => {
                setAuthMessage(null);
                signOutCurrentUser().catch((error) =>
                  setAuthMessage(formatError(error)),
                );
              }}
              style={{ padding: 10, borderRadius: 10, backgroundColor: "#222" }}
            >
              <Text style={{ color: "white" }}>Sign out</Text>
            </Pressable>

            <Text style={{ color: "#888" }}>
              Entitled episodes: {(entitlement?.unlockedEpisodeIds ?? []).join(", ") || "-"}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              disabled={authBusy}
              onPress={handleGoogleSignIn}
              style={{
                padding: 10,
                borderRadius: 10,
                backgroundColor: "#1f6feb",
                opacity: authBusy ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
                Continue with Google
              </Text>
            </Pressable>
          </View>
        )}

        {authBusy ? <ActivityIndicator /> : null}
        {authMessage ? <Text style={{ color: "#ff8f8f" }}>{authMessage}</Text> : null}
        {purchaseStatus ? <Text style={{ color: "#9ad1ff" }}>{purchaseStatus}</Text> : null}
        {checkout.createSession.error ? (
          <Text style={{ color: "#ff8f8f" }}>{checkout.createSession.error}</Text>
        ) : null}

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

        {episodesState.status === "loading" ? (
          <Text style={{ color: "#999" }}>Loading episodes...</Text>
        ) : null}

        {episodesState.status === "error" && episodesState.error ? (
          <Text style={{ color: "#ff8f8f" }}>{episodesState.error}</Text>
        ) : null}
      </View>
    );
  }, [
    user,
    entitlement,
    authBusy,
    authMessage,
    purchaseStatus,
    checkout.createSession.error,
    episodesState.status,
    episodesState.error,
  ]);

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
          const unlocked = hasAccess(entitlement, item);
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
                <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
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
                        Locked
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

              {item.description ? <Text style={{ color: "#bbb" }}>{item.description}</Text> : null}

              <Text style={{ color: "#888" }}>
                {!unlocked
                  ? "Locked - purchase required"
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
                    {buyingEpisodeId === item.id ? "Opening checkout..." : "Buy"}
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
