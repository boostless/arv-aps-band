<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

// PROPS
const props = defineProps<{
    modelValue: boolean; // Controls open/close (v-model)
    invoiceId: Id<'invoices'> | undefined | null;
    remainingAmount: number; // In Cents (to auto-fill max amount)
}>();

// EMITS
const emit = defineEmits(['update:modelValue', 'success']);

// MUTATION
const { mutate: addPayment, isPending } = useConvexMutation(api.payments.add);

// FORM STATE
const form = ref({
    amountDisplay: 0,
    method: 'bank',
    notes: ''
});

// WATCHERS
// When dialog opens, reset form and auto-fill amount
watch(() => props.modelValue, (isOpen) => {
    if (isOpen) {
        form.value.amountDisplay = props.remainingAmount > 0 ? props.remainingAmount / 100 : 0;
        form.value.method = 'bank';
        form.value.notes = '';
    }
});

// ACTIONS
function close() {
    emit('update:modelValue', false);
}

async function handleSubmit() {
    if (!props.invoiceId) return;
    if (form.value.amountDisplay <= 0) return;

    try {
        await addPayment({
            invoice_id: props.invoiceId,
            amount: Math.round(form.value.amountDisplay * 100), // Convert to cents
            date: Date.now(),
            method: form.value.method as any,
            notes: form.value.notes
        });

        emit('success'); // Parent handles toast/refresh
        close();
    } catch (err) {
        console.error(err);
        // You might want to emit an 'error' event or handle toast here if you inject useSnackbar
    }
}
</script>

<template>
    <v-dialog :model-value="modelValue" @update:model-value="close" max-width="400">
        <v-card>
            <v-card-title>Record Payment</v-card-title>
            <v-card-subtitle v-if="remainingAmount > 0" class="text-success font-weight-bold mb-2">
                Balance Due: €{{ (remainingAmount / 100).toFixed(2) }}
            </v-card-subtitle>

            <v-card-text class="pt-4">
                <v-text-field v-model.number="form.amountDisplay" label="Amount (€)" type="number" variant="outlined"
                    autofocus :rules="[v => v > 0 || 'Amount must be positive']"></v-text-field>

                <v-select v-model="form.method" :items="['bank', 'cash', 'card']" label="Method"
                    variant="outlined"></v-select>

                <v-text-field v-model="form.notes" label="Notes (Optional)" variant="outlined"></v-text-field>
            </v-card-text>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="close">Cancel</v-btn>
                <v-btn color="success" variant="flat" :loading="isPending" @click="handleSubmit">
                    Confirm
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>