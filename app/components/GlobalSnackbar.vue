<script setup lang="ts">
const { show, message, color } = useSnackbar();
</script>

<template>
    <v-snackbar v-model="show" :color="color" location="bottom right" timeout="4000" elevation="24">
        <div class="d-flex align-center">
            <v-icon v-if="color === 'success'" class="mr-2">mdi-check-circle</v-icon>
            <v-icon v-if="color === 'error'" class="mr-2">mdi-alert-circle</v-icon>
            <span class="font-weight-medium">{{ message }}</span>
        </div>

        <template v-slot:actions>
            <v-btn icon="mdi-close" variant="text" size="small" @click="show = false"></v-btn>
        </template>
    </v-snackbar>
</template>