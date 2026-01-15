<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import { localeStatus } from '~~/shared/utils/localeStatus'; // Assuming this maps stock types

const { data: dashboard, isPending } = useConvexQuery(api.dashboard.getStats, {});

// -- UTILS --
function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString('lt-LT', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

// 1. HELPERS FOR UNIFIED LOGS
function getActivityIcon(item: any) {
    if (item.category === 'stock') {
        switch (item.type) {
            case 'sale': return 'mdi-logout';
            case 'return': return 'mdi-login';
            case 'audit': return 'mdi-clipboard-check';
            default: return 'mdi-package-variant';
        }
    }
    // Finance
    if (item.type === 'invoice_created') return 'mdi-file-document-outline';
    if (item.type === 'payment_received') return 'mdi-cash-multiple';
    return 'mdi-circle-small';
}

function getActivityColor(item: any) {
    if (item.category === 'stock') {
        if (item.value_text.startsWith('+')) return 'success';
        if (item.value_text.startsWith('-')) return 'orange-darken-2';
        return 'grey';
    }
    // Finance
    if (item.type === 'invoice_created') return 'primary';
    if (item.type === 'payment_received') return 'green-darken-1';
    return 'grey';
}

function getActivityLabel(type: string) {
    // Custom labels for finance, fallback to localeStatus for stock
    const map: Record<string, string> = {
        'invoice_created': 'Sąskaita',
        'payment_received': 'Mokėjimas',
    };
    return map[type] || (localeStatus as Record<string, string>)[type] || type;
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

                    <v-table density="compact">
                        <thead>
                            <tr>
                                <th>Nr.</th>
                                <th>Klientas</th>
                                <th class="text-end">Veiksmas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="order in dashboard?.activeOrders" :key="order._id">
                                <td class="font-weight-medium">#{{ order.contract_number }}</td>
                                <td class="text-truncate" style="max-width: 150px;">{{ order.customerName }}</td>
                                <td class="text-end">
                                    <v-btn icon="mdi-chevron-right" size="x-small" variant="text"
                                        :to="`/orders/${order._id}`"></v-btn>
                                </td>
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

                    <v-table density="compact">
                        <thead>
                            <tr>
                                <th>Sąskaita</th>
                                <th>Terminas</th>
                                <th class="text-end">Liko mokėti</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="inv in dashboard?.unpaidInvoices" :key="inv._id">
                                <td class="font-weight-medium">#{{ inv.invoice_number }}</td>
                                <td>
                                    <span :class="inv.isOverdue ? 'text-error font-weight-bold' : ''">
                                        {{ formatDate(inv.end_date) }}
                                    </span>
                                </td>
                                <td class="text-end font-weight-bold text-error">
                                    €{{ formatMoney(inv.remainingAmount) }}
                                </td>
                                <td class="text-end">
                                    <v-btn icon="mdi-arrow-right" size="x-small" variant="text" color="primary"
                                        :to="`/invoices/${inv._id}`"></v-btn>
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
                <v-card-title>Veiklos istorija</v-card-title>
                <v-card-subtitle>Paskutiniai sandėlio ir finansų įvykiai</v-card-subtitle>
            </v-card-item>

            <v-divider></v-divider>

            <v-table density="comfortable" hover>
                <thead>
                    <tr>
                        <th>Laikas</th>
                        <th>Įvykis</th>
                        <th>Aprašymas</th>
                        <th>Detalės</th>
                        <th class="text-end">Reikšmė</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="log in dashboard?.recentLogs" :key="log._id">
                        <td class="text-caption text-medium-emphasis" style="width: 130px">
                            {{ formatDate(log.time) }}
                        </td>

                        <td>
                            <v-chip size="x-small" label variant="tonal" class="font-weight-bold text-uppercase"
                                :color="getActivityColor(log)" :prepend-icon="getActivityIcon(log)">
                                {{ getActivityLabel(log.type) }}
                            </v-chip>
                        </td>

                        <td class="font-weight-medium">
                            {{ log.primary_text }}
                        </td>

                        <td class="text-caption text-grey">
                            {{ log.secondary_text }}
                            <span v-if="log.ref_id && log.category === 'stock'" class="ml-1 text-disabled">
                                ({{ log.ref_id }})
                            </span>
                            <span v-if="log.ref_id && log.category === 'finance'" class="ml-1 text-disabled">
                                by {{ log.ref_id }}
                            </span>
                        </td>

                        <td class="text-end font-weight-bold" :class="getActivityColor(log)">
                            {{ log.value_text }}
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>
    </div>
</template>