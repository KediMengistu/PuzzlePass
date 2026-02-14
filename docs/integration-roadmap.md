# PuzzlePass Integration Roadmap (Post Phase 0–4)

This roadmap translates the current codebase into a practical sequence for integrating:
- Redux Toolkit state architecture
- Google Sign-In (web + native)
- Modern cross-platform component system
- Smooth transitions/micro-interactions
- Remaining phases (5–7)

## 1) Recommended implementation order

### Step 1 — State architecture first (Redux Toolkit + RTK Query)
Implement Redux before auth/UI refresh so async flows are standardized first.

Why now:
- Current async logic is spread across screens via `useEffect` + local state.
- Checkout/auth/episode actions all duplicate loading/error handling patterns.

Scope:
- Add `app/store/` with `configureStore`, typed hooks, and feature slices.
- Use RTK Query for read-heavy endpoints and status flags (`isLoading`, `isError`, etc.).
- Keep Firestore listeners where needed, but normalize output into store slices.

Suggested slices/APIs:
- `authSlice`: user, provider, authStatus
- `episodesSlice` or `episodesApi`: published episodes list
- `entitlementsSlice`: unlocked ids/subscriber flag
- `progressSlice`: per-episode progress state
- `checkoutSlice`: creating session, redirecting, verify status, errors
- `uiSlice`: toasts/modals/transitions preference

### Step 2 — Auth pivot to Google
After centralized state exists, replace anonymous-first entry with Google sign-in flow.

Scope:
- Web: Firebase Auth Google provider with popup/redirect fallback.
- Native: Expo AuthSession / Google identity flow mapped into Firebase credential.
- Preserve anonymous as optional guest mode only if product requires it.

Requirements:
- Update auth UX in home screen and purchase return page.
- Ensure Functions continue to rely on `request.auth.uid` unchanged.
- If checkout should reject anonymous, set `REQUIRE_NON_ANON_FOR_CHECKOUT=true`.

### Step 3 — Component system and design tokens
Once auth + state are stable, swap primitive UI (`View/Text/Pressable`) to a reusable design system.

Recommendation:
- Use **NativeWind + gluestack/ui** (or Tamagui as alternate).
- Rationale: strong Expo + web/native support, reusable primitives, themeability.

Scope:
- Create shared primitives (`Button`, `Card`, `Badge`, `Input`, `Skeleton`, `Toast`).
- Replace ad-hoc inline style objects in episode list, runner, purchase screens.
- Introduce typography scale, spacing, and semantic colors.

### Step 4 — Motion + micro-interactions
Apply animation after component standardization so interactions are consistent.

Recommendation:
- Prefer `react-native-reanimated` for cross-platform core motion.
- Use Moti for declarative mounted/unmounted transitions.
- On web, optional `framer-motion` wrappers can be used for route-level polish.

Scope by flow:
- Auth: button state transitions, success/failure notices.
- Episode list: card enter animations, lock/unlock badge transitions.
- Purchase: processing/success states and optimistic feedback.
- Scene runner: fade/slide between scenes, button press feedback, haptics.

## 2) What should be altered in existing code

### Current async state localizations should be migrated
Files currently hold per-screen loading/error/request state that should move to Redux actions/selectors:
- `app/app/(tabs)/index.tsx`
- `app/app/episode/[episodeId].tsx`
- `app/app/purchase.tsx`

### Firebase client bootstrap should be extended
`app/firebase/firebase.ts` should expose provider helpers for Google sign-in and maintain emulator/app-check behavior.

### Routing shell should include provider wiring
`app/app/_layout.tsx` should add Redux Provider (and any design-system/theme providers).

### Debug screen should be dev-only
`app/app/(tabs)/debug.tsx` and tab registration should be hidden in production builds.

### Security hardening gap to fix now
`storage.rules` is currently broad and time-based permissive; tighten before launch.

## 3) Target architecture for Redux Toolkit in this repo

## Folder shape

```text
app/
  store/
    index.ts
    hooks.ts
    api/
      episodesApi.ts
      checkoutApi.ts
    slices/
      authSlice.ts
      entitlementsSlice.ts
      progressSlice.ts
      uiSlice.ts
```

## Data-flow principles

- UI components should never call callable functions directly.
- Components dispatch actions / RTK Query triggers only.
- Loading/error state consumed via selectors only.
- Firestore snapshot subscriptions should dispatch normalized updates into store.

## 4) Phase-by-phase update plan

### Phase 5 (content automation)
- Add `tools/content/` Python package:
  - `validate_episode.py`
  - `publish_episode.py`
  - optional `new_episode.py`
- Add JSON/YAML schema for episodes/scenes.
- Add CI check that runs validation on content files.

### Phase 6 (“wow” feature)
Pick Option A (animations/micro-interactions) since codebase already includes haptics and reanimated dependencies in app package.

Implementation set:
- Scene transition animator wrapper
- Reveal/hint drawer animation
- Success/failure haptic feedback on submit
- Progress indicator with animated fill

### Phase 7 (polish + deploy)
- UI polish with component library complete across all screens.
- Add loading skeletons and empty states.
- Deploy checklist docs + architecture diagram + demo script.
- Add recruiter-ready README sections:
  - data model
  - security model
  - entitlement/payment lifecycle
  - content tooling commands

## 5) Concrete backlog (ordered)

1. Add Redux store + typed hooks + providers.
2. Migrate home screen async/auth/checkout state to Redux.
3. Migrate episode runner async scene/progress/error state to Redux.
4. Migrate purchase return verification state to Redux.
5. Implement Google Sign-In web and native; remove anonymous as default CTA.
6. Introduce component library primitives and replace inline styles on core screens.
7. Add animation wrappers and micro-interactions in all critical flows.
8. Add Python content tooling and one published sample via script.
9. Tighten storage rules + ensure env-driven secure defaults.
10. Final polish, deploy docs, demo assets.

## 6) Definition of done for your pivot

You are done when:
- Every async flow is represented in Redux state with reliable loading/error selectors.
- Google auth is the primary path on web/iOS/Android.
- Core screens use shared components (not ad-hoc inline styling).
- Scene/library/purchase transitions feel smooth and intentional.
- Content can be republished from one command.
- Security posture is production-safe for Firestore + Storage.
