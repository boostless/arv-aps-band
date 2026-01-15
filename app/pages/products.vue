<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

// -- GLOBAL UTILS --
const { trigger: showToast } = useSnackbar();

// -- QUERIES --
const showArchived = ref(false);
const { data: products, isPending: isLoading } = useConvexQuery(api.products.list, () => ({
    showArchived: showArchived.value
}));
const { data: units } = useConvexQuery(api.units.list, {}); // Needed for Dropdown

// -- MUTATIONS --
const { mutate: createProduct, isPending: isCreating } = useConvexMutation(api.products.create);
const { mutate: updateProduct, isPending: isUpdating } = useConvexMutation(api.products.update);
const { mutate: archiveProduct, isPending: isArchiving } = useConvexMutation(api.products.archive);

// -- STATE --
const dialog = ref(false);
const deleteDialog = ref(false);
const editingId = ref<Id<'products'> | null>(null);
const itemToDelete = ref<Id<'products'> | null>(null);

// Form State (Raw values)
const form = ref({
    code: '',
    label: '',
    type: 'product' as 'product' | 'service',
    unitId: '' as string, // We bind this to the ID
    priceDisplay: 0, // Visual price (e.g. 10.50)
    dailyPriceDisplay: 0, // NEW: Visual daily rental price
    // NEW: Store the visual KG value here
    weightDisplay: undefined as number | undefined,
});

// -- ACTIONS --

// 2. Update openCreate (Reset)
function openCreate() {
    editingId.value = null;
    form.value = {
        code: '',
        label: '',
        type: 'product',
        unitId: '',
        priceDisplay: 0,
        dailyPriceDisplay: 0,
        weightDisplay: undefined, // Reset to empty
    };
    dialog.value = true;
}

// 3. Update openEdit (Convert g -> kg)
function openEdit(item: any) {
    editingId.value = item._id;
    form.value = {
        code: item.code,
        label: item.label,
        type: item.type,
        unitId: item.unit,
        priceDisplay: item.price / 100,
        dailyPriceDisplay: item.daily_rental_price / 100,

        // MATH: Divide by 1000 to show KG
        weightDisplay: item.weight_gs ? item.weight_gs / 1000 : undefined,
    };
    dialog.value = true;
}

function confirmArchive(id: Id<'products'>) {
    itemToDelete.value = id;
    deleteDialog.value = true;
}

async function handleSubmit() {
    try {
        // Validate Unit
        if (!form.value.unitId) {
            showToast('Prašome pasirinkti vienetą', 'error');
            return;
        }

        const payload = {
            code: form.value.code,
            label: form.value.label,
            type: form.value.type,
            unit: form.value.unitId as Id<'units'>,
            price: Math.round(form.value.priceDisplay * 100), // Convert Dollars -> Cents
            weight_g: form.value.weightDisplay
                ? Math.round(form.value.weightDisplay * 1000)
                : undefined,
            archived: false,
            // Add defaults for optional fields if needed
            daily_rental_price: Math.round(form.value.dailyPriceDisplay * 100),
        };

        if (editingId.value) {
            await updateProduct({ id: editingId.value, ...payload });
            showToast('Produktas atnaujintas', 'success');
        } else {
            await createProduct(payload);
            showToast('Produktas sukurtas', 'success');
        }
        dialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

async function handleArchive() {
    if (!itemToDelete.value) return;
    try {
        await archiveProduct({ id: itemToDelete.value });
        showToast('Produktas archyvuotas', 'success');
        deleteDialog.value = false;
    } catch (err: any) {
        showToast('Nepavyko archyvuoti', 'error');
    }
}

// -- TABLE CONFIG --
const headers = [
    { title: 'Kodas', key: 'code' },
    { title: 'Produktas', key: 'label' },
    { title: 'Tipas', key: 'type' },
    { title: 'Vienetas', key: 'unitData.label' },
    { title: 'Kaina', key: 'price' },
    { title: 'Dienos nuomos kaina', key: 'daily_rental_price' },
    { title: 'Svoris (kg)', key: 'weight_g', align: 'end' as const },
    {
        title: 'Veiksmai',
        key: 'actions',
        sortable: false,
        align: 'end' as const  // <--- ADD THIS
    },
];
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Produktai</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Valdyti katalogą ir kainas</div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
                Pridėti produktą
            </v-btn>
        </div>

        <v-switch v-model="showArchived" label="Rodyti archyvuotus produktus" color="primary" hide-details
            class="mb-4"></v-switch>

        <v-card border flat>
            <v-data-table :headers="headers" :items="products || []" :loading="isLoading === undefined" hover>
                <template v-slot:item.price="{ item }">
                    ${{ (item.price / 100).toFixed(2) }}
                </template>

                <template v-slot:item.daily_rental_price="{ item }">
                    ${{ (item.daily_rental_price / 100).toFixed(2) }}
                </template>

                <template v-slot:item.type="{ item }">
                    <v-chip size="small" :color="item.type === 'service' ? 'purple' : 'blue'" variant="tonal"
                        class="text-uppercase">
                        {{ item.type === 'service' ? 'Paslauga' : 'Produktas' }}
                    </v-chip>
                </template>

                <template v-slot:item.weight_g="{ item }">
                    <span v-if="item.weight_g">
                        {{ (item.weight_g / 1000).toFixed(3) }} <span
                            class="text-caption text-medium-emphasis">kg</span>
                    </span>
                    <span v-else class="text-disabled">-</span>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn icon="mdi-pencil" size="small" variant="text" color="primary"
                        @click="openEdit(item)"></v-btn>
                    <v-btn v-if="!item.archived" icon="mdi-archive" size="small" variant="text" color="orange"
                        @click="confirmArchive(item._id)"></v-btn>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="600">
            <v-card>
                <v-card-title>{{ editingId ? 'Edit Product' : 'New Product' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="handleSubmit">
                        <v-row dense class="mt-2">

                            <v-col cols="8">
                                <v-text-field v-model="form.label" label="Pavadinimas" variant="outlined"
                                    density="compact" autofocus></v-text-field>
                            </v-col>
                            <v-col cols="4">
                                <v-text-field v-model="form.code" label="Kodas" variant="outlined"
                                    density="compact"></v-text-field>
                            </v-col>

                            <v-col cols="6">
                                <v-select v-model="form.type" :items="['product', 'service']" label="Tipas"
                                    variant="outlined" density="compact">
                                </v-select>
                            </v-col>
                            <v-col cols="6">
                                <v-autocomplete v-model="form.unitId" :items="units || []" item-title="label"
                                    item-value="_id" label="Vienetas" variant="outlined" density="compact"
                                    placeholder="Pasirinkite vienetą"></v-autocomplete>
                            </v-col>

                            <v-col cols="6">
                                <v-text-field v-model.number="form.priceDisplay" label="Kaina (€)" type="number"
                                    step="0.01" prefix="€" variant="outlined" density="compact"></v-text-field>
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model.number="form.dailyPriceDisplay" label="Dienos nuomos kaina (€)"
                                    type="number" step="0.01" prefix="€" variant="outlined"
                                    density="compact"></v-text-field>
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model.number="form.weightDisplay" label="Svoris (kg)" type="number"
                                    variant="outlined" density="compact" hint="Pasirinkite, jei taikoma"></v-text-field>
                            </v-col>

                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Atšaukti</v-btn>
                    <v-btn color="primary" variant="flat" :loading="isCreating || isUpdating" @click="handleSubmit">
                        Išsaugoti
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>Archyvuoti produktą?</v-card-title>
                <v-card-text>
                    Ar tikrai? Tai paslėps produktą iš pagrindinio sąrašo.
                    Jį galėsite atkurti vėliau, jei reikės.
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog = false">Atšaukti</v-btn>
                    <v-btn color="orange" variant="flat" :loading="isArchiving" @click="handleArchive">Archyvuoti</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>