<script setup lang="ts">
import { api } from '~~/convex/_generated/api';

// Auto-initialize defaults on first load
const { mutate: initDefaults } = useConvexMutation(api.seed.initializeDefaults);

onMounted(async () => {
  try {
    const result = await initDefaults({});
    if (result.created) {
      console.log('✅ Database initialized:', result);
    }
  } catch (err) {
    // Silently fail - defaults may already exist
    console.log('Defaults check:', err);
  }
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
