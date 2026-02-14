import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/firebase/firebase";
import { useAppDispatch } from "@/store/hooks";
import { authStateChanged } from "@/store/slices/auth-slice";

export function useAuthBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      dispatch(authStateChanged(user));
    });
  }, [dispatch]);
}
