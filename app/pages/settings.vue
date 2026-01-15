<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~~/convex/_generated/api';

const { trigger: showToast } = useSnackbar();

// -- DATA --
const { data: settings, isPending: isLoading } = useConvexQuery(api.settings.get, {});
const { mutate: saveSettings, isPending: isSaving } = useConvexMutation(api.settings.update);

// 1. UPDATE FORM STATE
const form = ref({
    business_name: '',
    company_code: '',
    vat_code: '',
    address: '',
    email: '', // <--- NEW
    phone: '', // <--- NEW
    tax_rate: 21,
    invoice_start_number: 1,
    banks: [] as { name: string; iban: string; swift: string }[]
});

// 2. UPDATE WATCHER (Load Data)
watch(settings, (newVal) => {
    if (newVal) {
        form.value = {
            // ... existing mappings ...
            business_name: newVal.business_name,
            company_code: newVal.company_code,
            vat_code: newVal.vat_code || '',
            address: newVal.address,

            email: newVal.email || '', // <--- MAP NEW FIELD
            phone: newVal.phone || '', // <--- MAP NEW FIELD

            tax_rate: newVal.tax_rate,
            invoice_start_number: newVal.invoice_start_number,
            banks: newVal.banks.map(b => ({ ...b, swift: b.swift || '' }))
        };
    }
});

// 3. UPDATE SAVE (Send Data)
async function handleSave() {
    try {
        await saveSettings({
            // ... existing ...
            business_name: form.value.business_name,
            company_code: form.value.company_code,
            vat_code: form.value.vat_code || undefined,
            address: form.value.address,

            email: form.value.email || undefined, // <--- SEND NEW FIELD
            phone: form.value.phone || undefined, // <--- SEND NEW FIELD

            tax_rate: Number(form.value.tax_rate),
            invoice_start_number: Number(form.value.invoice_start_number),
            banks: form.value.banks.map(b => ({
                name: b.name,
                iban: b.iban,
                swift: b.swift || undefined
            })),
        });
        showToast('Settings saved', 'success');
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// -- ACTIONS --

function addBank() {
    form.value.banks.push({ name: '', iban: '', swift: '' });
}

function removeBank(index: number) {
    form.value.banks.splice(index, 1);
}
</script>

<template>
    <div>
        <h1 class="text-h4 font-weight-bold mb-6">Įmonės nustatymai</h1>

        <v-form @submit.prevent="handleSave">
            <v-row>
                <v-col cols="12" md="8">
                    <v-card title="Company Details" border flat class="mb-4">
                        <v-card-text>
                            <v-row dense>
                                <v-col cols="12">
                                    <v-text-field v-model="form.business_name" label="Business Name" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>

                                <v-col cols="6">
                                    <v-text-field v-model="form.company_code" label="Company Code (Įmonės kodas)"
                                        variant="outlined" density="comfortable"></v-text-field>
                                </v-col>

                                <v-col cols="6">
                                    <v-text-field v-model="form.vat_code" label="VAT Code (PVM kodas)"
                                        placeholder="Optional" variant="outlined" density="comfortable"></v-text-field>
                                </v-col>

                                <v-col cols="12">
                                    <v-textarea v-model="form.address" label="Address" rows="2" variant="outlined"
                                        density="comfortable"></v-textarea>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.email" label="Business Email"
                                        prepend-inner-icon="mdi-email-outline" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.phone" label="Business Phone"
                                        prepend-inner-icon="mdi-phone-outline" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>

                    <v-card border flat>
                        <div class="d-flex justify-space-between align-center px-4 pt-4">
                            <div class="text-h6">Bank Accounts</div>
                            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-plus" @click="addBank">
                                Add Bank
                            </v-btn>
                        </div>

                        <v-card-text>
                            <div v-for="(bank, i) in form.banks" :key="i"
                                class="d-flex align-start mb-4 bg-grey-lighten-5 pa-3 rounded">
                                <v-row dense>
                                    <v-col cols="4">
                                        <v-text-field v-model="bank.name" label="Bank Name" density="compact"
                                            variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                    <v-col cols="5">
                                        <v-text-field v-model="bank.iban" label="IBAN" density="compact"
                                            variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                    <v-col cols="3">
                                        <v-text-field v-model="bank.swift" label="SWIFT" density="compact"
                                            variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                </v-row>

                                <v-btn icon="mdi-delete" size="small" variant="text" color="error" class="ml-2 mt-1"
                                    @click="removeBank(i)"></v-btn>
                            </div>
                            <div v-if="form.banks.length === 0" class="text-caption text-grey text-center">
                                No bank accounts added.
                            </div>
                        </v-card-text>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4">
                    <v-card title="Invoicing Defaults" border flat>
                        <v-card-text>
                            <v-text-field v-model.number="form.invoice_start_number" label="Next Invoice Number"
                                type="number" variant="outlined" density="comfortable"
                                hint="Auto-increments on generation" persistent-hint class="mb-4"></v-text-field>

                            <v-text-field v-model.number="form.tax_rate" label="Default VAT Rate (%)" type="number"
                                variant="outlined" density="comfortable" suffix="%"></v-text-field>
                        </v-card-text>

                        <v-divider></v-divider>

                        <v-card-actions class="pa-4">
                            <v-btn block color="primary" size="large" variant="flat" :loading="isSaving"
                                @click="handleSave">
                                Save Changes
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-form>
    </div>
</template>