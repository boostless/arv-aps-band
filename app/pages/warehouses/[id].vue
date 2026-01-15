<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const route = useRoute();
const warehouseId = route.params.id as Id<'warehouses'>;
const { trigger: showToast } = useSnackbar();

// -- QUERIES --
// 1. The Warehouse Info
const { data: warehouse } = useConvexQuery(api.warehouses.get, { id: warehouseId });

// 2. The Current Stock (Now only returns items IN the warehouse)
const { data: inventory, isPending } = useConvexQuery(api.stock.listByWarehouse, { warehouseId });

// 3. All Products (Needed for the "Add" dropdown)
const { data: allProducts } = useConvexQuery(api.products.list, { showArchived: false });

// -- MUTATION --
const { mutate: adjustStock, isPending: isAdjusting } = useConvexMutation(api.stock.adjust);

// -- DIALOG STATE --
const dialog = ref(false); // For Adjusting existing
const addDialog = ref(false); // For Adding NEW

// Selected item for ADJUSTING
const selectedItem = ref<any>(null);

// Form for ADDING NEW
const addForm = ref({
    productId: null as Id<'products'> | null,
    quantity: 1,
});

const adjustment = ref({
    delta: 0,
    reason: 'audit' as const, // Default reason
    notes: ''
});

// -- ACTIONS --

// 1. Open "Add New" Dialog
function openAdd() {
    addForm.value = { productId: null, quantity: 1 };
    addDialog.value = true;
}

// 2. Open "Adjust" Dialog (for existing items)
function openAdjust(item: any) {
    selectedItem.value = item;
    adjustment.value = { delta: 0, reason: 'audit', notes: '' };
    dialog.value = true;
}

// 3. Handle ADD NEW Item
async function handleAdd() {
    if (!addForm.value.productId) return;

    try {
        await adjustStock({
            product: addForm.value.productId,
            warehouse: warehouseId,
            delta: addForm.value.quantity,
            type: 'initial', // Special type for first add
            notes: 'Initial stock'
        });
        showToast('Item added to warehouse', 'success');
        addDialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// 4. Handle ADJUST Existing
async function handleAdjust() {
    if (!selectedItem.value || adjustment.value.delta === 0) return;

    try {
        await adjustStock({
            product: selectedItem.value.productId, // Note: using productId from our joined object
            warehouse: warehouseId,
            delta: adjustment.value.delta,
            type: adjustment.value.reason,
            notes: adjustment.value.notes
        });

        showToast('Stock updated', 'success');
        dialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// -- TABLE HEADERS --
const headers = [
    { title: 'Product', key: 'label' },
    { title: 'SKU', key: 'code' },
    { title: 'Quantity', key: 'quantity' },
    { title: 'Daily Rental Price', key: 'daily_rental_price' },
    { title: 'Unit Price', key: 'price' },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
];
</script>

<template>
    <div>
        <div class="mb-6">
            <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/warehouses" class="mb-2 pl-0">
                Back
            </v-btn>

            <div class="d-flex align-center justify-space-between">
                <div>
                    <h1 class="text-h4 font-weight-bold">{{ warehouse?.label || 'Loading...' }}</h1>
                    <div class="text-subtitle-1 text-medium-emphasis">Inventory Management</div>
                </div>

                <v-btn color="primary" prepend-icon="mdi-plus" size="large" @click="openAdd">
                    Add Stock
                </v-btn>
            </div>
        </div>

        <v-card border flat>
            <v-data-table :headers="headers" :items="inventory || []" :loading="isPending" hover>
                <template v-slot:no-data>
                    <div class="pa-8 text-center">
                        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-package-variant</v-icon>
                        <div class="text-h6 text-grey">This warehouse is empty</div>
                        <div class="text-body-2 text-grey mb-4">Add products to start tracking inventory here.</div>
                        <v-btn variant="outlined" color="primary" @click="openAdd">Add First Item</v-btn>
                    </div>
                </template>

                <template v-slot:item.price="{ item }">
                    ${{ (item.price / 100).toFixed(2) }}
                </template>

                <template v-slot:item.daily_rental_price="{ item }">
                    ${{ (item.daily_rental_price / 100).toFixed(2) }}
                </template>

                <template v-slot:item.quantity="{ item }">
                    <v-chip color="blue-grey" variant="flat" size="small">{{ item.quantity }}</v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-swap-horizontal"
                        @click="openAdjust(item)">
                        Adjust
                    </v-btn>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="addDialog" max-width="500">
            <v-card>
                <v-card-title>Add Item to Warehouse</v-card-title>
                <v-card-text class="pt-4">
                    <v-autocomplete v-model="addForm.productId" :items="allProducts || []" item-title="label"
                        item-value="_id" label="Search Product" placeholder="Type to search..." variant="outlined"
                        density="comfortable" prepend-inner-icon="mdi-magnify" autofocus>
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props" :subtitle="item.raw.code"></v-list-item>
                        </template>
                    </v-autocomplete>

                    <v-text-field v-model.number="addForm.quantity" label="Initial Quantity" type="number"
                        variant="outlined" min="1"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="addDialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :disabled="!addForm.productId" :loading="isAdjusting"
                        @click="handleAdd">
                        Add Item
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="dialog" max-width="500">
            <v-card v-if="selectedItem">
                <v-card-title>Adjust Stock: {{ selectedItem.label }}</v-card-title>
                <v-card-text class="pt-4">
                    <v-select v-model="adjustment.reason" label="Reason"
                        :items="['purchase', 'sale', 'transfer', 'audit']" variant="outlined"
                        density="compact"></v-select>

                    <v-text-field v-model.number="adjustment.delta" label="Change (+/-)" type="number"
                        variant="outlined" autofocus hint="Use negative to remove stock" persistent-hint></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :loading="isAdjusting" @click="handleAdjust">
                        Confirm
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>