import {
  BaseQueryFn,
  createApi,
  fakeBaseQuery,
} from "@reduxjs/toolkit/query/react";
import { httpsCallable } from "firebase/functions";

import { functions } from "@/firebase/firebase";

type CallableError = {
  code: string;
  message: string;
};

const callFunction = async <TReq, TRes>(
  name: string,
  payload: TReq,
): Promise<TRes> => {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const result = await fn(payload);
  return result.data;
};

const callableBaseQuery: BaseQueryFn<
  {
    functionName: string;
    payload: unknown;
  },
  unknown,
  CallableError
> = fakeBaseQuery();

export type StartEpisodeInput = { episodeId: string };
export type StartEpisodeOutput = { currentSceneId: string; isCompleted: boolean };

export type SubmitActionInput = {
  episodeId: string;
  sceneId: string;
  action: { type: "continue" } | { type: "code"; code: string } | { type: "choice"; optionId: string };
};

export type SubmitActionOutput = {
  isCompleted: boolean;
  nextSceneId: string | null;
};

export type RestartEpisodeInput = { episodeId: string };
export type RestartEpisodeOutput = { currentSceneId: string; isCompleted: boolean };

export type CreateCheckoutSessionInput = {
  episodeId: string;
  successUrl?: string;
  cancelUrl?: string;
};

export type CreateCheckoutSessionOutput = { url: string; reused: boolean };

export type VerifyCheckoutSessionInput = { sessionId: string };
export type VerifyCheckoutSessionOutput = {
  status: "paid_unlocked" | "already_entitled" | "not_paid";
  episodeId: string;
  payment_status?: string;
};

export const puzzleApi = createApi({
  reducerPath: "puzzleApi",
  baseQuery: callableBaseQuery,
  endpoints: (builder) => ({
    startEpisode: builder.mutation<StartEpisodeOutput, StartEpisodeInput>({
      async queryFn(arg) {
        try {
          const data = await callFunction<StartEpisodeInput, StartEpisodeOutput>(
            "startEpisode",
            arg,
          );
          return { data };
        } catch (e: any) {
          return {
            error: {
              code: e?.code ?? "unknown",
              message: e?.message ?? String(e),
            },
          };
        }
      },
    }),
    submitAction: builder.mutation<SubmitActionOutput, SubmitActionInput>({
      async queryFn(arg) {
        try {
          const data = await callFunction<SubmitActionInput, SubmitActionOutput>(
            "submitAction",
            arg,
          );
          return { data };
        } catch (e: any) {
          return {
            error: {
              code: e?.code ?? "unknown",
              message: e?.message ?? String(e),
            },
          };
        }
      },
    }),
    restartEpisode: builder.mutation<RestartEpisodeOutput, RestartEpisodeInput>({
      async queryFn(arg) {
        try {
          const data = await callFunction<RestartEpisodeInput, RestartEpisodeOutput>(
            "restartEpisode",
            arg,
          );
          return { data };
        } catch (e: any) {
          return {
            error: {
              code: e?.code ?? "unknown",
              message: e?.message ?? String(e),
            },
          };
        }
      },
    }),
    createCheckoutSession: builder.mutation<
      CreateCheckoutSessionOutput,
      CreateCheckoutSessionInput
    >({
      async queryFn(arg) {
        try {
          const data = await callFunction<
            CreateCheckoutSessionInput,
            CreateCheckoutSessionOutput
          >("createCheckoutSession", arg);
          return { data };
        } catch (e: any) {
          return {
            error: {
              code: e?.code ?? "unknown",
              message: e?.message ?? String(e),
            },
          };
        }
      },
    }),
    verifyCheckoutSession: builder.mutation<
      VerifyCheckoutSessionOutput,
      VerifyCheckoutSessionInput
    >({
      async queryFn(arg) {
        try {
          const data = await callFunction<
            VerifyCheckoutSessionInput,
            VerifyCheckoutSessionOutput
          >("verifyCheckoutSession", arg);
          return { data };
        } catch (e: any) {
          return {
            error: {
              code: e?.code ?? "unknown",
              message: e?.message ?? String(e),
            },
          };
        }
      },
    }),
  }),
});

export const {
  useStartEpisodeMutation,
  useSubmitActionMutation,
  useRestartEpisodeMutation,
  useCreateCheckoutSessionMutation,
  useVerifyCheckoutSessionMutation,
} = puzzleApi;
