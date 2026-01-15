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
    email: '',
    phone: '',
    tax_rate: 21,
    invoice_start_number: 1,
    invoice_due_days: 14, // <--- NEW: Default Due Date
    banks: [] as { name: string; iban: string; swift: string }[],
    employees: [] as { name: string; role?: string }[] // <--- NEW: Employee List
});

// 2. UPDATE WATCHER (Load Data)
watch(settings, (newVal) => {
    if (newVal) {
        form.value = {
            business_name: newVal.business_name,
            company_code: newVal.company_code,
            vat_code: newVal.vat_code || '',
            address: newVal.address,

            email: newVal.email || '',
            phone: newVal.phone || '',

            tax_rate: newVal.tax_rate,
            invoice_start_number: newVal.invoice_start_number,
            invoice_due_days: newVal.invoice_due_days || 14, // <--- MAP NEW FIELD

            banks: newVal.banks.map((b: any) => ({
                name: b.name,
                iban: b.iban,
                swift: b.swift || ''
            })),

            // <--- MAP EMPLOYEES
            employees: newVal.employees ? newVal.employees.map((e: any) => ({
                name: e.name,
                role: e.role || ''
            })) : []
        };
    }
});

// 3. UPDATE SAVE (Send Data)
async function handleSave() {
    if (!settings.value) return;

    try {
        await saveSettings({
            business_name: form.value.business_name,
            company_code: form.value.company_code,
            vat_code: form.value.vat_code || undefined,
            address: form.value.address,

            email: form.value.email || undefined,
            phone: form.value.phone || undefined,

            tax_rate: Number(form.value.tax_rate),
            invoice_start_number: Number(form.value.invoice_start_number),
            invoice_due_days: Number(form.value.invoice_due_days), // <--- SEND NEW FIELD

            banks: form.value.banks.map(b => ({
                name: b.name,
                iban: b.iban,
                swift: b.swift || undefined
            })),

            // <--- SEND EMPLOYEES (Filter out empty names)
            employees: form.value.employees.filter(e => e.name.trim() !== '')
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

// -- NEW: EMPLOYEE ACTIONS --
function addEmployee() {
    form.value.employees.push({ name: '', role: '' });
}

function removeEmployee(index: number) {
    form.value.employees.splice(index, 1);
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

                    <v-card border flat class="mb-4">
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

                    <v-card border flat>
                        <div class="d-flex justify-space-between align-center px-4 pt-4">
                            <div class="text-h6">Employees</div>
                            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-plus"
                                @click="addEmployee">
                                Add Employee
                            </v-btn>
                        </div>
                        <v-card-subtitle class="px-4">Manage names available for "Created By" on
                            invoices</v-card-subtitle>

                        <v-card-text>
                            <div v-for="(emp, i) in form.employees" :key="i" class="d-flex align-center mb-2">
                                <v-row dense>
                                    <v-col cols="7">
                                        <v-text-field v-model="emp.name" label="Name" placeholder="John Doe"
                                            density="compact" variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                    <v-col cols="5">
                                        <v-text-field v-model="emp.role" label="Role (Optional)" placeholder="Manager"
                                            density="compact" variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-btn icon="mdi-delete" size="small" variant="text" color="error" class="ml-2"
                                    @click="removeEmployee(i)"></v-btn>
                            </div>

                            <div v-if="form.employees.length === 0" class="text-caption text-grey text-center py-2">
                                No employees added yet.
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
                                variant="outlined" density="comfortable" suffix="%" class="mb-4"></v-text-field>

                            <v-text-field v-model.number="form.invoice_due_days" label="Payment Terms (Days)"
                                type="number" variant="outlined" density="comfortable" suffix="days"
                                hint="Default due date for new invoices" persistent-hint></v-text-field>
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