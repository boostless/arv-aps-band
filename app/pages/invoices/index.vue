<script setup lang="ts">
import { api } from '~~/convex/_generated/api';

const { data: invoices, isPending } = useConvexQuery(api.invoices.list, {});

// -- COMPUTED STATS --
const stats = computed(() => {
    if (!invoices.value) return { totalDue: 0, overdueCount: 0 };

    let totalDue = 0;
    let overdueCount = 0;

    invoices.value.forEach(inv => {
        if (inv.remainingAmount > 0 && inv.status !== 'void') {
            totalDue += inv.remainingAmount;
            if (inv.isOverdue) overdueCount++;
        }
    });

    return { totalDue, overdueCount };
});

// -- UTILS --
function formatMoney(cents: number) {
    return (cents / 100).toFixed(2);
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('lt-LT');
}

// -- HEADERS --
const headers = [
    { title: 'Sąskaita #', key: 'invoice_number' },
    { title: 'Data', key: 'start_date' },
    { title: 'Klientas', key: 'customerName' },
    { title: 'Suma', key: 'amount', align: 'end' as const },
    { title: 'Apmokėta', key: 'paidAmount', align: 'end' as const },
    { title: 'Balansas', key: 'remainingAmount', align: 'end' as const },
    { title: 'Statusas', key: 'status', align: 'center' as const }
];

const router = useRouter();

const handleClick = (event: any, { item }: any) => {
    router.push(`/invoices/${item._id}`);
};
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Sąskaitos</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Finansinė apžvalga</div>
            </div>
        </div>

        <v-row class="mb-4">
            <v-col cols="12" md="4">
                <v-card border flat color="red-lighten-5">
                    <v-card-text>
                        <div class="text-caption font-weight-bold text-red-darken-4 text-uppercase">Iš viso neapmokėta
                        </div>
                        <div class="text-h4 font-weight-bold text-red-darken-4">€{{ formatMoney(stats.totalDue) }}</div>
                        <div v-if="stats.overdueCount > 0" class="text-caption text-red-darken-3 mt-1">
                            {{ stats.overdueCount }} sąskaitos vėluoja
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-card border flat>
            <v-data-table :headers="headers" :items="invoices || []" :loading="isPending" hover density="comfortable" @click:row="handleClick">

                <template v-slot:item.invoice_number="{ item }">
                    <span class="font-weight-medium">#{{ item.invoice_number }}</span>
                </template>

                <template v-slot:item.start_date="{ item }">
                    {{ formatDate(item.start_date) }}
                </template>

                <template v-slot:item.amount="{ item }">
                    <span class="font-weight-bold">€{{ formatMoney(item.amount) }}</span>
                </template>

                <template v-slot:item.paidAmount="{ item }">
                    <span class="text-medium-emphasis">€{{ formatMoney(item.paidAmount) }}</span>
                </template>

                <template v-slot:item.remainingAmount="{ item }">
                    <span v-if="item.remainingAmount > 0" class="text-red font-weight-bold">
                        €{{ formatMoney(item.remainingAmount) }}
                    </span>
                    <span v-else class="text-success text-caption font-weight-bold">APMOKĖTA</span>
                </template>

                <template v-slot:item.status="{ item }">
                    <v-chip v-if="item.remainingAmount <= 0" color="success" size="small" variant="tonal" label>
                        Apmokėta
                    </v-chip>
                    <v-chip v-else-if="item.status === 'void'" color="grey" size="small" variant="tonal" label>
                        Anuliuota
                    </v-chip>
                    <v-chip v-else :color="item.isOverdue ? 'error' : 'warning'" size="small" variant="tonal" label>
                        {{ item.isOverdue ? 'Vėluoja' : 'Neapmokėta' }}
                    </v-chip>
                </template>

                <template v-slot:no-data>
                    <div class="pa-8 text-center text-grey">
                        <v-icon size="64" class="mb-4">mdi-file-document-outline</v-icon>
                        <div>Dar nėra sugeneruota sąskaitų.</div>
                        <div class="text-caption">Eikite į aktyvų užsakymą, kad sugeneruotumėte sąskaitą.</div>
                    </div>
                </template>
            </v-data-table>
        </v-card>
    </div>
</template>