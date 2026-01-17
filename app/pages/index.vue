<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import { localeStatus } from '~~/shared/utils/localeStatus';
import EUR from '~~/shared/utils/money';

const { data: dashboard, isPending } = useConvexQuery(api.dashboard.getStats, {});

// -- UTILS --
function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString('lt-LT', {
        month: 'short', day: 'numeric' // Short date
    });
}

function getDeltaColor(delta: number) {
    if (delta > 0) return 'text-success';
    if (delta < 0) return 'text-error';
    return 'text-grey';
}

function getLogColor(type: string) {
    switch (type) {
        case 'purchase': return 'teal';
        case 'sale': return 'blue-darken-2';
        case 'rental_out': return 'orange-darken-2';
        case 'return': return 'success';
        case 'transfer': return 'purple';
        case 'audit': return 'error';
        default: return 'grey';
    }
}

function getLogIcon(type: string) {
    switch (type) {
        case 'purchase': return 'mdi-cash-minus';
        case 'sale': return 'mdi-cash-plus';
        case 'rental_out': return 'mdi-truck-delivery';
        case 'return': return 'mdi-keyboard-return';
        case 'transfer': return 'mdi-swap-horizontal';
        case 'audit': return 'mdi-clipboard-check';
        default: return 'mdi-information-outline';
    }
}
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <h1 class="text-h4 font-weight-bold">Apžvalga</h1>

            <div>
                <v-btn to="/orders/create" color="primary" prepend-icon="mdi-plus" class="mr-2">
                    Naujas užsakymas
                </v-btn>
            </div>
        </div>

        <v-row>
            <v-col cols="12" md="6">
                <v-card border flat class="h-100">
                    <v-card-item>
                        <template v-slot:prepend>
                            <v-icon color="primary" class="mr-2">mdi-clock-outline</v-icon>
                        </template>
                        <v-card-title>Aktyvūs užsakymai</v-card-title>
                        <v-card-subtitle>Įranga, kuri šiuo metu išnuomota</v-card-subtitle>
                        <template v-slot:append>
                            <v-btn variant="text" size="small" color="primary" to="/orders">Visos</v-btn>
                        </template>
                    </v-card-item>

                    <v-divider></v-divider>

                    <v-table density="compact" :loading="isPending" hover>
                        <thead>
                            <tr>
                                <th>Nr.</th>
                                <th>Klientas</th>
                                <th class="text-right">Dienos kaina</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="order in dashboard?.activeOrders" :key="order._id" class="cursor-pointer" @click="$router.push(`/orders/${order._id}`)">
                                <td class="font-weight-medium">#{{ order.contract_number }}</td>
                                <td class="text-truncate" style="max-width: 150px;">{{ order.customerName }}</td>
                                <td class="text-right">{{ EUR(order.total_amount).format() }}</td>
                            </tr>
                            <tr v-if="dashboard?.activeOrders.length === 0">
                                <td colspan="3" class="text-center text-caption text-grey py-4">
                                    Nėra aktyvių sutarčių.
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>
            </v-col>

            <v-col cols="12" md="6">
                <v-card border flat class="h-100">
                    <v-card-item>
                        <template v-slot:prepend>
                            <v-icon color="red-darken-2" class="mr-2">mdi-alert-circle-outline</v-icon>
                        </template>
                        <v-card-title>Neapmokėtos sąskaitos</v-card-title>
                        <v-card-subtitle>Apmokėjimo laukiantys dokumentai</v-card-subtitle>
                        <template v-slot:append>
                            <v-btn variant="text" size="small" color="primary" to="/invoices">Visos</v-btn>
                        </template>
                    </v-card-item>

                    <v-divider></v-divider>

                    <v-table density="compact" :loading="isPending" hover>
                        <thead>
                            <tr>
                                <th>Sąskaita</th>
                                <th>Terminas</th>
                                <th class="text-end">Liko mokėti</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="inv in dashboard?.unpaidInvoices" :key="inv._id" class="cursor-pointer" @click="$router.push(`/invoices/${inv._id}`)">
                                <td class="font-weight-medium">#{{ inv.invoice_number }}</td>
                                <td>
                                    <span :class="inv.isOverdue ? 'text-error font-weight-bold' : ''">
                                        {{ formatDate(inv.end_date) }}
                                    </span>
                                </td>
                                <td class="text-end font-weight-bold text-error">
                                    {{ EUR(inv.remainingAmount).format() }}
                                </td>
                            </tr>
                            <tr v-if="dashboard?.unpaidInvoices.length === 0">
                                <td colspan="4" class="text-center text-caption text-success py-4">
                                    <v-icon color="success" class="mb-1">mdi-check-circle</v-icon><br>
                                    Visos sąskaitos apmokėtos!
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>
            </v-col>
        </v-row>

        <v-card border flat class="mt-6">
            <v-card-item>
                <template v-slot:prepend>
                    <v-icon color="blue-grey" class="mr-2">mdi-history</v-icon>
                </template>
                <v-card-title>Sandėlio istorija</v-card-title>
            </v-card-item>

            <v-divider></v-divider>

            <v-table density="comfortable" hover :loading="isPending">
                <thead>
                    <tr>
                        <th>Laikas</th>
                        <th>Tipas</th>
                        <th>Produktas</th>
                        <th>Sandėlis</th>
                        <th class="text-end">Kiekis</th>
                        <th>Pastabos</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="log in dashboard?.recentLogs" :key="log._id">
                        <td class="text-caption text-medium-emphasis" style="width: 140px">
                            {{ formatDate(log._creationTime) }}
                        </td>
                        <td>
                            <v-chip size="x-small" label variant="tonal" class="font-weight-bold text-uppercase"
                                :color="getLogColor(log.type)" :prepend-icon="getLogIcon(log.type)">
                                {{ localeStatus[log.type] || log.type }}
                            </v-chip>
                        </td>
                        <td class="font-weight-medium">{{ log.productName }}</td>
                        <td class="text-caption">{{ log.warehouseCode }}</td>
                        <td class="text-end font-weight-bold" :class="getDeltaColor(log.delta)">
                            {{ log.delta > 0 ? '+' : '' }}{{ log.delta }}
                        </td>
                        <td class="text-caption text-grey text-truncate" style="max-width: 200px;">
                            {{ log.reference_id || log.notes }}
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>
    </div>
</template>