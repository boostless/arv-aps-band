<script setup lang="ts">
useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'googlebot', content: 'noindex, nofollow' },
    { name: 'bingbot', content: 'noindex, nofollow' }
  ]
})

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
