<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import { localeStatus } from '~~/shared/utils/localeStatus';

const { data: dashboard, isPending } = useConvexQuery(api.dashboard.getStats, {});

// -- UTILS --
function formatDate(timestamp: number) {
    // Short format: "Jan 14, 10:30"
    return new Date(timestamp).toLocaleString('lt-LT', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function getDeltaColor(delta: number) {
    if (delta > 0) return 'text-success';
    if (delta < 0) return 'text-error';
    return 'text-grey';
}
</script>

<template>
    <div>
        <h1 class="text-h4 font-weight-bold mb-6">Apžvalga</h1>

        <v-row>
            <v-col cols="12" md="6">
                <v-card border flat class="h-100">
                    <v-card-item>
                        <template v-slot:prepend>
                            <v-icon color="primary" class="mr-2">mdi-clock-outline</v-icon>
                        </template>
                        <v-card-title>Esami užsakymai</v-card-title>
                        <v-card-subtitle>Naujausi aktyvūs nuomos ir pardavimai</v-card-subtitle>

                        <template v-slot:append>
                            <v-btn variant="text" size="small" color="primary" to="/orders">Peržiūrėti visus</v-btn>
                        </template>
                    </v-card-item>

                    <v-divider></v-divider>

                    <v-table density="compact" class="mt-2">
                        <thead>
                            <tr>
                                <th>Sąskaita</th>
                                <th>Klientas</th>
                                <th>Data</th>
                                <th class="text-end">Veiksmas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="order in dashboard?.activeOrders" :key="order._id">
                                <td class="font-weight-medium">#{{ order.invoice_number }}</td>
                                <td>{{ order.customerName }}</td>
                                <td class="text-caption text-grey">{{ formatDate(order.start_date) }}</td>
                                <td class="text-end">
                                    <v-btn icon="mdi-chevron-right" size="x-small" variant="text"
                                        :to="`/orders/${order._id}`"></v-btn>
                                </td>
                            </tr>
                            <tr v-if="dashboard?.activeOrders.length === 0">
                                <td colspan="4" class="text-center text-caption text-grey py-4">
                                    Šiuo metu nėra aktyvių užsakymų.
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>
            </v-col>

            <v-col cols="12" md="6">
                <v-row dense>
                    <v-col cols="6">
                        <v-card color="primary" variant="tonal" class="pa-4 h-100" to="/orders/create">
                            <div class="text-h6 font-weight-bold">Naujas užsakymas</div>
                            <div class="text-caption">Sukurti pardavimą arba nuomą</div>
                            <v-icon size="40" class="position-absolute"
                                style="bottom: 10px; right: 10px; opacity: 0.2">mdi-file-document-plus</v-icon>
                        </v-card>
                    </v-col>
                    <v-col cols="6">
                        <v-card color="orange" variant="tonal" class="pa-4 h-100" to="/warehouses">
                            <div class="text-h6 font-weight-bold">Sandėliai</div>
                            <div class="text-caption">Peržiūrėti sandėlių likučius</div>
                            <v-icon size="40" class="position-absolute"
                                style="bottom: 10px; right: 10px; opacity: 0.2">mdi-package-variant</v-icon>
                        </v-card>
                    </v-col>
                </v-row>
            </v-col>
        </v-row>

        <v-card border flat class="mt-6">
            <v-card-item>
                <template v-slot:prepend>
                    <v-icon color="blue-grey" class="mr-2">mdi-history</v-icon>
                </template>
                <v-card-title>Naujausia veikla</v-card-title>
                <v-card-subtitle>Sandėlio judėjimai ir koregavimai</v-card-subtitle>
            </v-card-item>

            <v-divider></v-divider>

            <v-table density="comfortable" hover>
                <thead>
                    <tr>
                        <th>Laikas</th>
                        <th>Tipas</th>
                        <th>Produktas</th>
                        <th>Sandėlis</th>
                        <th class="text-end">Pokytis</th>
                        <th>Nuoroda</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="log in dashboard?.recentLogs" :key="log._id">
                        <td class="text-caption text-medium-emphasis" style="width: 140px">
                            {{ formatDate(log._creationTime) }}
                        </td>

                        <td>
                            <v-chip size="small" label
                                :color="log.type === 'return' ? 'success' : log.type === 'sale' ? 'blue' : 'grey'">
                                {{ localeStatus[log.type] || log.type }}
                            </v-chip>
                        </td>

                        <td class="font-weight-medium">{{ log.productName }}</td>
                        <td class="text-caption">{{ log.warehouseCode }}</td>

                        <td class="text-end font-weight-bold" :class="getDeltaColor(log.delta)">
                            {{ log.delta > 0 ? '+' : '' }}{{ log.delta }}
                        </td>

                        <td class="text-caption text-grey" style="max-width: 200px;">
                            <div class="text-truncate">
                                {{ log.reference_id || log.notes }}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>
    </div>
</template>