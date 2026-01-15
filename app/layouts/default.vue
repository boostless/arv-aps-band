<script setup lang="ts">
import { ref } from 'vue'

const drawer = ref(true) // Controls sidebar visibility

// Navigation Menu Items
const items = ref([
    {
        title: 'Apžvalga',
        to: '/',
        icon: 'mdi-view-dashboard-outline'
    },
    { type: 'subheader', title: 'Greitieji veiksmai' },
    {
        title: 'Naujas užsakymas',
        to: '/orders/create',
        icon: 'mdi-plus-box-outline'
    },
    { type: 'subheader', title: 'Katalogas' },
    {
        title: 'Užsakymai',
        to: '/orders',
        icon: 'mdi-file-document-outline'
    },
    {
        title: 'Sąskaitos',
        to: '/invoices',
        icon: 'mdi-receipt-text'
    },
    {
        title: 'Produktai',
        to: '/products',
        icon: 'mdi-tag-outline'
    },
    {
        title: 'Klientai',
        to: '/customers',
        icon: 'mdi-account-multiple-outline'
    },
    { type: 'subheader', title: 'Konfigūracija' },
    {
        title: 'Sandėliai',
        to: '/warehouses',
        icon: 'mdi-warehouse'
    },
    {
        title: 'Mato vienetai',
        to: '/units',
        icon: 'mdi-ruler'
    },
    {
        title: 'Produkto tipai',
        to: '/productTypes',
        icon: 'mdi-shape-outline'
    },
    {
        title: 'Įmonės nustatymai',
        to: '/settings',
        icon: 'mdi-cog-outline'
    },
])
</script>

<template>
    <v-app>
        <ClientOnly>
            <v-navigation-drawer v-model="drawer" app>
                <div class="d-flex align-center pa-4">
                    <v-avatar color="primary" class="mr-3" size="40">
                        <span class="text-h6 text-white">I</span>
                    </v-avatar>
                    <div>
                        <div class="text-subtitle-1 font-weight-bold">Arvėriva ERP</div>
                        <div class="text-caption text-grey">VakarisT</div>
                    </div>
                </div>

                <v-divider></v-divider>

                <v-list density="compact" nav>
                    <template v-for="(item, i) in items" :key="i">
                        <v-list-subheader v-if="item.type === 'subheader'">
                            {{ item.title }}
                        </v-list-subheader>

                        <v-list-item v-else :to="item.to" :prepend-icon="item.icon" :title="item.title" color="primary"
                            rounded="lg"></v-list-item>
                    </template>
                </v-list>
            </v-navigation-drawer>
        </ClientOnly>

        <v-app-bar flat border>
            <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-bell-outline"></v-btn>
        </v-app-bar>

        <v-main class="bg-grey-lighten-4">
            <v-container fluid class="pa-6">
                <slot />
            </v-container>
        </v-main>
        <GlobalSnackbar />
    </v-app>
</template>