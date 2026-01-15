# GitHub Copilot Instructions for Invoice/Inventory System

## Tech Stack
- **Frontend:** Vue 3 (Composition API, `<script setup lang="ts">`), Nuxt 3.
- **UI Framework:** Vuetify 3 (Material Design).
- **Backend:** Convex (Serverless Database & Functions).
- **Language:** TypeScript.

## Backend Guidelines (Convex)
1.  **File Structure:**
    -   Public functions go in `convex/*.ts`.
    -   Schema definitions go in `convex/schema/*.ts`.
    -   Internal helpers (not callable from client) must be defined with `internalMutation` or `internalQuery` and imported from `./_generated/server`.

2.  **Mutations & Queries:**
    -   Always use `v` from `convex/values` for argument validation.
    -   **Mutations:** Use `ctx.db` to read/write. NEVER use `fetch` or external APIs in mutations.
    -   **Queries:** Use `ctx.db` to read only.
    -   **Actions:** Use `ctx.runQuery` or `ctx.runMutation` to talk to the DB. Use `fetch` here for external APIs (e.g., Gotenberg).

3.  **Specific Patterns:**
    -   **PDF Generation:** Use the "Trigger & Watch" pattern.
        1.  Frontend calls a Mutation (`requestPdf`).
        2.  Mutation sets status to "generating" and schedules an Action (`ctx.scheduler.runAfter(0, ...)`).
        3.  Action generates the PDF (using Gotenberg), saves to Storage, and calls an `internalMutation` (`savePdfUrl`) to update the record with the URL.
    -   **Settings:** The `business_settings` table uses the Singleton pattern (only one record). Queries should usually fetch `.first()`.

## Frontend Guidelines (Vue 3)
1.  **Convex Hooks:**
    -   Use `const { data } = useConvexQuery(api.resource.get, { arg: val })`.
    -   Use `const { mutate, isPending } = useConvexMutation(api.resource.update)`.
    -   **Do not** use `useConvexAction` directly if a mutation wrapper is available.

2.  **Vuetify Usage:**
    -   Use `density="compact"` or `density="comfortable"` for data-heavy forms.
    -   Use `variant="outlined"` for text fields.
    -   Grid system: `<v-row>`, `<v-col cols="12" md="6">`.

3.  **Error Handling:**
    -   Wrap async operations in `try/catch`.
    -   Use `showToast(error.message, 'error')` for user feedback.

## Code Style
-   Use explicit typing for props and emit.
-   Prefer `interface` over `type` for object definitions.
-   When mapping database objects to form state, use `watch` or `watchEffect` to react to data loading.