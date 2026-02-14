import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useVerifyCheckoutSessionMutation } from "@/store/api/puzzle-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuthUser, selectCheckoutState } from "@/store/selectors";
import {
  checkoutFlowReset,
  checkoutRedirectCancelled,
  checkoutRedirectCompleted,
} from "@/store/slices/checkout-slice";

function firstParam(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export default function PurchaseReturn() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const dispatch = useAppDispatch();

  const purchase = firstParam(params.purchase);
  const sessionId = firstParam(params.session_id);

  const user = useAppSelector(selectAuthUser);
  const checkout = useAppSelector(selectCheckoutState);
  const [verifyCheckoutSession] = useVerifyCheckoutSessionMutation();

  const verifiedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    dispatch(checkoutFlowReset());
  }, [dispatch, purchase, sessionId]);

  useEffect(() => {
    if (purchase !== "cancel") return;
    dispatch(checkoutRedirectCancelled());

    const timer = setTimeout(() => router.replace("/"), 600);
    return () => clearTimeout(timer);
  }, [dispatch, purchase, router]);

  useEffect(() => {
    if (purchase !== "success") return;
    if (!sessionId || !user?.uid) return;
    if (verifiedSessionRef.current === sessionId) return;

    verifiedSessionRef.current = sessionId;
    dispatch(checkoutRedirectCompleted());
    verifyCheckoutSession({ sessionId }).catch(() => null);
  }, [dispatch, purchase, sessionId, user?.uid, verifyCheckoutSession]);

  useEffect(() => {
    if (checkout.verifySession.status !== "ready") return;

    const timer = setTimeout(() => router.replace("/"), 700);
    return () => clearTimeout(timer);
  }, [checkout.verifySession.status, router]);

  const status = useMemo(() => {
    if (!purchase) return "Waiting for return...";

    if (purchase === "cancel") {
      return "Purchase cancelled.";
    }

    if (purchase !== "success") {
      return `Unknown purchase status: ${purchase}`;
    }

    if (!sessionId) {
      return "Payment returned, but session_id is missing.";
    }

    if (!user?.uid) {
      return "Sign in to confirm your purchase.";
    }

    if (checkout.verifySession.status === "loading") {
      return "Confirming purchase...";
    }

    if (checkout.verifySession.status === "error") {
      return `Verification failed: ${checkout.verifySession.error ?? "Unknown error."}`;
    }

    if (checkout.verifySession.status !== "ready") {
      return "Waiting for verification...";
    }

    if (checkout.verifySession.result?.status === "paid_unlocked") {
      return `Purchase confirmed. Unlocked ${checkout.verifySession.result.episodeId}.`;
    }

    if (checkout.verifySession.result?.status === "already_entitled") {
      return `Already unlocked ${checkout.verifySession.result.episodeId}.`;
    }

    if (checkout.verifySession.result?.status === "not_paid") {
      return "Payment not completed yet.";
    }

    return "Purchase verification finished.";
  }, [checkout.verifySession.error, checkout.verifySession.result, checkout.verifySession.status, purchase, sessionId, user?.uid]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "black",
        padding: 16,
        justifyContent: "center",
        gap: 12,
      }}
    >
      <Text style={{ color: "white", fontSize: 20, fontWeight: "800" }}>
        Purchase
      </Text>

      <Text style={{ color: "#bbb" }}>{status}</Text>

      {checkout.verifySession.status === "loading" ? <ActivityIndicator /> : null}

      <Pressable
        onPress={() => router.replace("/")}
        style={{
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          backgroundColor: "#222",
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "700" }}
        >
          Back to Home
        </Text>
      </Pressable>
    </View>
  );
}
