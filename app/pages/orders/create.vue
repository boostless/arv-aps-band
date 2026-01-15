<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const router = useRouter();
const { trigger: showToast } = useSnackbar();

// -- DATA SOURCES --
const { data: customers } = useConvexQuery(api.customers.list, { showArchived: false });
const { data: products } = useConvexQuery(api.products.list, { showArchived: false });
const { data: warehouses } = useConvexQuery(api.warehouses.list, { showArchived: false });
const { data: settings } = useConvexQuery(api.settings.get, {});

// -- MUTATION --
const { mutate: createOrder, isPending: isSubmitting } = useConvexMutation(api.orders.create);

// -- FORM STATE --
const form = ref({
    customer: null as Id<'customers'> | null,
    start_date: new Date().toISOString().substr(0, 10), // YYYY-MM-DD
    end_date: null as string | null,
    notes: '',
    type: 'rental' as 'rental' | 'sale',
    items: [] as any[]
});

// -- ITEM LINE LOGIC --
function addItem() {
    form.value.items.push({
        productId: null,
        warehouseId: null,
        quantity: 1,
        priceDisplay: 0,
        discount: 0,
        // Helper fields for UI
        productObj: null,
        type: 'product'
    });
}

function removeItem(index: number) {
    form.value.items.splice(index, 1);
}

// When a product is selected, auto-fill price and defaults
function onProductSelect(item: any, product: any) {
    if (!product) return;

    item.productId = product._id;
    item.productObj = product;
    item.type = product.type;

    // Auto-select warehouse
    if (warehouses.value && warehouses.value.length > 0) {
        item.warehouseId = warehouses.value[0]._id;
    }

    // SET PRICE BASED ON TYPE
    updateItemPrice(item);
}

// 2. NEW: HELPER TO UPDATE PRICE
function updateItemPrice(item: any) {
    if (!item.productObj) return;

    if (form.value.type === 'rental') {
        // Use Daily Rental Price (fallback to 0 or standard price if missing)
        const rentPrice = item.productObj.daily_rental_price || 0;
        item.priceDisplay = rentPrice / 100;
    } else {
        // Use Sale Price
        const salePrice = item.productObj.price || 0;
        item.priceDisplay = salePrice / 100;
    }
}

watch(() => form.value.type, (newType) => {
    form.value.items.forEach(item => {
        updateItemPrice(item);
    });
});

// -- TOTALS CALCULATION --
const grandTotal = computed(() => {
    if (!settings.value) return 0;

    // 1. Calculate Net Subtotal (Price * Qty - Discount)
    const netSubtotal = form.value.items.reduce((sum, item) => {
        const price = item.priceDisplay || 0;
        const qty = item.quantity || 0;
        const disc = item.discount || 0;

        const lineTotal = price * qty * (1 - disc / 100);
        return sum + lineTotal;
    }, 0);

    // 2. Add Tax
    const tax = netSubtotal * (settings.value.tax_rate / 100);

    return netSubtotal + tax;
});

const subtotalDisplay = computed(() => {
    if (!settings.value) return 0;
    // Reverse calc from Grand Total isn't needed if we build up
    return form.value.items.reduce((sum, item) => {
        const price = item.priceDisplay || 0;
        const qty = item.quantity || 0;
        const disc = item.discount || 0;
        return sum + (price * qty * (1 - disc / 100));
    }, 0);
});

// -- SUBMIT --
async function handleSubmit() {
    if (!form.value.customer) {
        showToast('Please select a customer', 'error');
        return;
    }
    if (form.value.items.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
    }

    // Validate all items have warehouse
    for (const item of form.value.items) {
        if (item.type === 'product' && !item.warehouseId) {
            showToast(`Please select a warehouse for ${item.productObj?.label || 'Item'}`, 'error');
            return;
        }
    }

    try {
        const payloadItems = form.value.items.map(item => ({
            product: item.productId,
            warehouse: item.warehouseId || warehouses.value?.[0]._id, // Fallback for services
            quantity: item.quantity,
            price: Math.round(item.priceDisplay * 100), // To Cents
            discount: item.discount,
            label: item.productObj.label,
            code: item.productObj.code,
            product_type: item.type,
        }));

        await createOrder({
            customer: form.value.customer,
            start_date: new Date(form.value.start_date).getTime(),
            end_date: form.value.end_date ? new Date(form.value.end_date).getTime() : undefined,
            type: form.value.type,
            items: payloadItems,
            created_by: 'Admin', // Replace with Auth user later
            notes: form.value.notes
        });

        showToast('Contract created successfully', 'success');
        router.push('/orders');

    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}
</script>

<template>
    <div class="pb-12">
        <div class="d-flex justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Sukurti užsakymą</h1>
                <div class="text-subtitle-1 text-medium-emphasis">
                    {{ form.type === 'rental' ? 'Nauja nuomos sutartis' : 'Naujas pardavimo užsakymas' }}
                </div>
            </div>

        </div>

        <v-form @submit.prevent="handleSubmit">
            <v-row>
                <v-col cols="12">
                    <v-card border flat class="mb-4">
                        <v-card-text>
                            <v-row>
                                <v-col cols="12" md="4">
                                    <v-autocomplete v-model="form.customer" :items="customers || []" item-title="label"
                                        item-value="_id" label="Klientas" variant="outlined"
                                        prepend-inner-icon="mdi-account"></v-autocomplete>
                                </v-col>
                                <v-col cols="6" md="2">
                                    <v-select v-model="form.type" :items="['rental', 'sale']" label="Tipas"
                                        variant="outlined"></v-select>
                                </v-col>
                                <v-col cols="6" md="3">
                                    <v-text-field v-model="form.start_date" type="date" label="Pradžios data"
                                        variant="outlined"></v-text-field>
                                </v-col>
                                <v-col cols="6" md="3">
                                    <v-text-field v-model="form.end_date" type="date" label="Pabaigos data (Pasirinktinai)"
                                        variant="outlined" :disabled="form.type === 'sale'"></v-text-field>
                                </v-col>
                            </v-row>
                            <v-row dense class="mt-2">
                                <v-col cols="12">
                                    <v-textarea v-model="form.notes" label="Pastabos / Instrukcijos"
                                        placeholder="pvz. Pristatyti prie galinio vartų, Skambinti atvykus..." rows="2"
                                        variant="outlined" density="comfortable" hide-details></v-textarea>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>

                <v-col cols="12">
                    <v-card border flat>
                        <v-table>
                            <thead>
                                <tr>
                                    <th style="width: 25%">Produktas</th>
                                    <th style="width: 20%">Sandėlis</th>
                                    <th style="width: 10%">Kiekis</th>
                                    <th style="width: 15%">Kaina</th>
                                    <th style="width: 10%">Nuolaida %</th>
                                    <th style="width: 15%" class="text-right">Iš viso</th>
                                    <th style="width: 5%"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, i) in form.items" :key="i">
                                    <td>
                                        <v-autocomplete :items="products || []" item-title="label" return-object
                                            variant="plain" hide-details placeholder="Pasirinkite produktą"
                                            @update:model-value="(val) => onProductSelect(item, val)"></v-autocomplete>
                                    </td>

                                    <td>
                                        <v-select v-model="item.warehouseId" :items="warehouses || []" item-title="code"
                                            item-value="_id" variant="plain" density="compact" hide-details
                                            :disabled="item.type === 'service'"
                                            :placeholder="item.type === 'service' ? 'Paslauga' : 'Pasirinkite sandėlį'"></v-select>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.quantity" type="number" variant="plain"
                                            hide-details density="compact" min="1"></v-text-field>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.priceDisplay" type="number" prefix="€"
                                            variant="plain" hide-details density="compact"
                                            :label="form.type === 'rental' ? 'Dienos kaina' : 'Vieneto kaina'"></v-text-field>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.discount" type="number" suffix="%"
                                            variant="plain" hide-details density="compact"></v-text-field>
                                    </td>

                                    <td class="text-right font-weight-bold">
                                        €{{ (item.priceDisplay * item.quantity * (1 - item.discount / 100)).toFixed(2)
                                        }}
                                    </td>

                                    <td>
                                        <v-btn icon="mdi-delete" size="small" variant="text" color="error"
                                            @click="removeItem(i)"></v-btn>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>

                        <div class="pa-4 border-top">
                            <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addItem">
                                Pridėti produktą
                            </v-btn>
                        </div>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4" offset-md="8">
                    <v-card border flat class="bg-grey-lighten-5">
                        <v-card-text>
                            <div class="d-flex justify-space-between mb-2">
                                <span>Viso</span>
                                <span class="font-weight-medium">€{{ subtotalDisplay.toFixed(2) }}</span>
                            </div>
                            <div class="d-flex justify-space-between mb-4">
                                <span>PVM ({{ settings?.tax_rate || 21 }}%)</span>
                                <span class="font-weight-medium">€{{ (grandTotal - subtotalDisplay).toFixed(2) }}</span>
                            </div>
                            <v-divider class="mb-4"></v-divider>
                            <div class="d-flex justify-space-between text-h5 font-weight-bold">
                                <span>Galutinė suma</span>
                                <span>€{{ grandTotal.toFixed(2) }}</span>
                            </div>
                            <div v-if="form.type === 'rental'"
                                class="text-caption text-right text-medium-emphasis mt-1">
                                (Per dieną)
                            </div>
                        </v-card-text>
                        <v-card-actions class="pa-4">
                            <v-btn block color="success" size="large" variant="flat" :loading="isSubmitting"
                                @click="handleSubmit">
                                Sukurti užsakymą
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-form>
    </div>
</template>