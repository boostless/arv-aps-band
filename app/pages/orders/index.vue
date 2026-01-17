<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
// Use the ID type for type safety if available
import type { Id } from '~~/convex/_generated/dataModel';
import EUR from '~~/shared/utils/money';

const router = useRouter();

// -- DATA --
const { data: orders, isPending } = useConvexQuery(api.orders.list, {});
const { mutate: completeOrder, isPending: isCompleting } = useConvexMutation(api.orders.complete);
const { trigger: showToast } = useSnackbar();

// -- UTILS --
function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

function getStatusColor(status: string) {
    switch (status) {
        case 'active': return 'blue';
        case 'completed': return 'success';
        case 'draft': return 'grey';
        case 'cancelled': return 'error';
        default: return 'grey';
    }
}

// -- HEADERS --
const headers = [
    // CHANGED: Invoice # -> Contract #
    { title: 'Užsakymas #', key: 'contract_number' },
    { title: 'Data', key: 'start_date' },
    { title: 'Klientas', key: 'customerName' },
    { title: 'Tipas', key: 'type' },
    { title: 'Statusas', key: 'status' },
    // This is now the "Contract Value" or "Daily Rate" depending on type
    { title: 'Galutinė suma / Įkainis', key: 'total_amount', align: 'end' as const },
    { title: 'Veiksmai', key: 'actions', sortable: false, align: 'end' as const },
];

async function handleComplete(orderId: Id<'orders'>) {
    if (!confirm('Ar tikrai? Tai grąžins visus produktus į sandėlį ir uždarys užsakymą.')) return;

    try {
        await completeOrder({ id: orderId });
        showToast('Užsakymas užbaigtas ir produktai grąžinti į sandėlį', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

const handleClick = (event: any, { item }: any) => {
    router.push(`/orders/${item._id}`);
};
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Užsakymai</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Valdykite aktyvias nuomas ir pardavimus</div>
            </div>

            <v-btn color="primary" prepend-icon="mdi-plus" size="large" to="/orders/create">
                Naujas užsakymas
            </v-btn>
        </div>

        <v-card border flat>
            <v-data-table :headers="headers" :items="orders || []" :loading="isPending" hover density="comfortable" @click:row="handleClick">

                <template v-slot:item.contract_number="{ item }">
                    <span class="font-weight-bold text-decoration-none">
                        #{{ item.contract_number }}
                    </span>
                </template>

                <template v-slot:item.start_date="{ item }">
                    {{ formatDate(item.start_date) }}
                </template>

                <template v-slot:item.type="{ item }">
                    <div class="d-flex align-center">
                        <v-icon size="small" class="mr-2" :color="item.type === 'rental' ? 'orange' : 'blue'">
                            {{ item.type === 'rental' ? 'mdi-clock-outline' : 'mdi-cart-outline' }}
                        </v-icon>
                        <span class="text-capitalize">{{ item.type }}</span>
                    </div>
                </template>

                <template v-slot:item.status="{ item }">
                    <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal"
                        class="text-uppercase font-weight-bold">
                        {{ item.status }}
                    </v-chip>
                </template>

                <template v-slot:item.total_amount="{ item }">
                    <span class="font-weight-bold">
                        {{ EUR(item.total_amount).format() }}
                    </span>
                    <span v-if="item.type === 'rental'" class="text-caption text-medium-emphasis ml-1">/day</span>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn v-if="item.status == 'active' && item.type == 'rental'" icon="mdi-check-circle-outline"
                        size="small" variant="text" color="green" @click="handleComplete(item._id)"
                        :loading="isCompleting">
                        <v-icon>mdi-check-circle-outline</v-icon>
                        <v-tooltip activator="parent" location="top">Užbaikti ir uždaryti</v-tooltip>
                    </v-btn>
                </template>

                <template v-slot:no-data>
                    <div class="pa-8 text-center">
                        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-file-document-outline</v-icon>
                        <div class="text-h6 text-grey">Nerasta užsakymų</div>
                        <v-btn variant="text" color="primary" class="mt-2" to="/orders/create">
                            Sukurti pirmą užsakymą
                        </v-btn>
                    </div>
                </template>

            </v-data-table>
        </v-card>
    </div>
</template>