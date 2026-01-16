<script setup lang="ts">
import { api } from '~~/convex/_generated/api';

// Auto-initialize defaults on first load
const { mutate: initDefaults } = useConvexMutation(api.seed.initializeDefaults);

onMounted(async () => {
  try {
    await initDefaults({});
  } catch (err) {
    // Silently fail - defaults may already exist
  }
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
