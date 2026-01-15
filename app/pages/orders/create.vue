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
    type: 'rental' as 'rental' | 'sale',
    notes: '',
    items: [] as any[]
});

// -- ITEM LINE LOGIC --
function addItem() {
    form.value.items.push({
        productId: null,
        warehouseId: null, // User must pick where to take it from
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
    item.productObj = product; // Keep full object for label/code
    item.type = product.type;
    item.priceDisplay = form.value.type == 'rental' ? product.daily_rental_price / 100 : product.price / 100; // Convert cents to dollars

    // Auto-select first warehouse if available, or leave null
    if (warehouses.value && warehouses.value.length > 0) {
        item.warehouseId = warehouses.value[0]._id;
    }
}

// -- TOTALS CALCULATION --
const grandTotal = computed(() => {
    if (!settings.value) return 0;

    const subtotal = form.value.items.reduce((sum, item) => {
        const price = item.priceDisplay || 0;
        const qty = item.quantity || 0;
        const disc = item.discount || 0;
        return sum + (price * qty * (1 - disc / 100));
    }, 0);

    const tax = subtotal * (settings.value.tax_rate / 100);
    return subtotal + tax;
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
            showToast(`Please select a warehouse for ${item.productObj?.label}`, 'error');
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

        showToast('Order created successfully', 'success');
        router.push('/orders'); // Redirect to list (we'll make this later)

    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}
</script>

<template>
    <div class="pb-12">
        <div class="d-flex justify-space-between mb-6">
            <h1 class="text-h4 font-weight-bold">Create Order</h1>
            <div v-if="settings" class="text-h6 text-medium-emphasis">
                Next Invoice: #{{ settings.invoice_start_number }}
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
                                        item-value="_id" label="Customer" variant="outlined"
                                        prepend-inner-icon="mdi-account"></v-autocomplete>
                                </v-col>
                                <v-col cols="6" md="2">
                                    <v-select v-model="form.type" :items="['rental', 'sale']" label="Type"
                                        variant="outlined"></v-select>
                                </v-col>
                                <v-col cols="6" md="3">
                                    <v-text-field v-model="form.start_date" type="date" label="Start Date"
                                        variant="outlined"></v-text-field>
                                </v-col>
                                <v-col cols="6" md="3">
                                    <v-text-field v-model="form.end_date" type="date" label="End Date (Optional)"
                                        variant="outlined" :disabled="form.type === 'sale'"></v-text-field>
                                </v-col>
                            </v-row>
                            <v-row dense class="mt-2">
                                <v-col cols="12">
                                    <v-textarea v-model="form.notes" label="Order Notes / Instructions"
                                        placeholder="e.g. Deliver to the back gate, Call upon arrival..." rows="2"
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
                                    <th style="width: 25%">Product</th>
                                    <th style="width: 20%">Warehouse</th>
                                    <th style="width: 10%">Qty</th>
                                    <th style="width: 15%">Price</th>
                                    <th style="width: 10%">Disc %</th>
                                    <th style="width: 15%" class="text-right">Total</th>
                                    <th style="width: 5%"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, i) in form.items" :key="i">
                                    <td>
                                        <v-autocomplete :items="products || []" item-title="label" return-object
                                            variant="plain" hide-details placeholder="Select Product"
                                            @update:model-value="(val) => onProductSelect(item, val)"></v-autocomplete>
                                    </td>

                                    <td>
                                        <v-select v-model="item.warehouseId" :items="warehouses || []" item-title="code"
                                            item-value="_id" variant="plain" density="compact" hide-details
                                            :disabled="item.type === 'service'"
                                            :placeholder="item.type === 'service' ? 'Service' : 'Select WH'"></v-select>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.quantity" type="number" variant="plain"
                                            hide-details density="compact" min="1"></v-text-field>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.priceDisplay" type="number" prefix="$"
                                            variant="plain" hide-details density="compact"></v-text-field>
                                    </td>

                                    <td>
                                        <v-text-field v-model.number="item.discount" type="number" suffix="%"
                                            variant="plain" hide-details density="compact"></v-text-field>
                                    </td>

                                    <td class="text-right font-weight-bold">
                                        ${{ (item.priceDisplay * item.quantity * (1 - item.discount / 100)).toFixed(2)
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
                                Add Line Item
                            </v-btn>
                        </div>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4" offset-md="8">
                    <v-card border flat class="bg-grey-lighten-5">
                        <v-card-text>
                            <div class="d-flex justify-space-between mb-2">
                                <span>Subtotal</span>
                                <span class="font-weight-medium">${{ (grandTotal / (1 + (settings?.tax_rate ||
                                    21) / 100)).toFixed(2) }}</span>
                            </div>
                            <div class="d-flex justify-space-between mb-4">
                                <span>VAT ({{ settings?.tax_rate }}%)</span>
                                <span class="font-weight-medium">${{ (grandTotal - (grandTotal / (1 +
                                    (settings?.tax_rate || 21) / 100))).toFixed(2) }}</span>
                            </div>
                            <v-divider class="mb-4"></v-divider>
                            <div class="d-flex justify-space-between text-h5 font-weight-bold">
                                <span>Total</span>
                                <span>${{ grandTotal.toFixed(2) }}</span>
                            </div>
                        </v-card-text>
                        <v-card-actions class="pa-4">
                            <v-btn block color="success" size="large" variant="flat" :loading="isSubmitting"
                                @click="handleSubmit">
                                Create Order
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-form>
    </div>
</template>