import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "../firebase/firebase";

function fmtErr(e: any) {
  const code = e?.code ?? "";
  const msg = e?.message ?? String(e);
  return `${code} ${msg}`.trim();
}

function firstParam(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default function PurchaseReturn() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const purchase = firstParam(params.purchase);
  const session_id = firstParam(params.session_id);

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [status, setStatus] = useState<string>("Waiting for return…");
  const [busy, setBusy] = useState<boolean>(false);

  const verifyFn = useMemo(
    () => httpsCallable(functions, "verifyCheckoutSession"),
    [],
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!purchase) return;

    if (purchase === "cancel") {
      setStatus("Purchase cancelled.");
      const t = setTimeout(() => router.replace("/"), 600);
      return () => clearTimeout(t);
    }

    if (purchase !== "success") {
      setStatus(`Unknown purchase status: ${purchase}`);
      return;
    }

    if (!session_id) {
      setStatus("Payment returned, but session_id is missing.");
      return;
    }

    if (!user?.uid) {
      setStatus("Sign in to confirm your purchase.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setBusy(true);
        setStatus("Confirming purchase…");

        const res = await verifyFn({ sessionId: session_id });
        const data = res.data as any;

        if (cancelled) return;

        if (data?.status === "paid_unlocked") {
          setStatus(`Purchase confirmed. Unlocked ${data.episodeId}.`);
        } else if (data?.status === "already_entitled") {
          setStatus(`Already unlocked ${data.episodeId}.`);
        } else if (data?.status === "not_paid") {
          setStatus("Payment not completed yet.");
        } else {
          setStatus("Purchase verification finished.");
        }

        setTimeout(() => router.replace("/"), 700);
      } catch (e: any) {
        if (cancelled) return;
        setStatus(`Verification failed: ${fmtErr(e)}`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [purchase, session_id, user?.uid]);

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

      {busy ? <ActivityIndicator /> : null}

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
