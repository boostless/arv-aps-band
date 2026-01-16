<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '~~/convex/_generated/api';

const { trigger: showToast } = useSnackbar();

// -- DATA --
const { data: settings } = useConvexQuery(api.settings.get, {});
const { mutate: saveSettings, isPending: isSaving } = useConvexMutation(api.settings.update);
const { mutate: generateUploadUrl } = useConvexMutation(api.files.generateUploadUrl);

// 1. UPDATE FORM STATE
const form = ref({
    business_name: '',
    company_code: '',
    vat_code: '',
    address: '',
    email: '',
    phone: '',
    fax_number: '',
    tax_rate: 21,
    invoice_start_number: 1,
    invoice_due_days: 14,
    banks: [] as { name: string; iban: string; swift: string }[],
    employees: [] as { name: string; role?: string }[],

    // ✅ ADDED: Missing Template Fields
    invoice_template_id: '',
    act_template_id: ''
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
            fax_number: newVal.fax_number || '',

            tax_rate: newVal.tax_rate,
            invoice_start_number: newVal.invoice_start_number,
            invoice_due_days: newVal.invoice_due_days || 14,

            // ✅ ADDED: Map Template IDs
            invoice_template_id: newVal.invoice_template_id || '',
            act_template_id: newVal.act_template_id || '',

            banks: newVal.banks.map((b: any) => ({
                name: b.name,
                iban: b.iban,
                swift: b.swift || ''
            })),

            employees: newVal.employees ? newVal.employees.map((e: any) => ({
                name: e.name,
                role: e.role || ''
            })) : []
        };
    }
});

const isUploading = ref(false);

async function handleFileUpload(file: File, type: 'invoice' | 'act') {
    if (!file) return;

    isUploading.value = true;
    try {
        // 1. Get Upload URL
        const postUrl = await generateUploadUrl({});

        // 2. Upload to Convex Storage
        const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
        });

        if (!result.ok) throw new Error("Įvyko klaida įkeliant failą.");

        const { storageId } = await result.json();

        // ✅ Update the form state
        if (type === 'invoice') form.value.invoice_template_id = storageId;
        if (type === 'act') form.value.act_template_id = storageId;

        showToast("Šablonas įkeltas! Spauskite Išsaugoti, kad pritaikytumėte.", "success");

    } catch (err: any) {
        showToast("Įkėlimo klaida: " + err.message, "error");
    } finally {
        isUploading.value = false;
    }
}

// 3. UPDATE SAVE (Send Data)
async function handleSave() {
    try {
        await saveSettings({
            business_name: form.value.business_name,
            company_code: form.value.company_code,
            vat_code: form.value.vat_code || undefined,
            address: form.value.address,

            email: form.value.email || undefined,
            phone: form.value.phone || undefined,
            fax_number: form.value.fax_number || undefined,

            tax_rate: Number(form.value.tax_rate),
            invoice_start_number: Number(form.value.invoice_start_number),
            invoice_due_days: Number(form.value.invoice_due_days),

            // ✅ ADDED: Send Template IDs to backend
            invoice_template_id: form.value.invoice_template_id || undefined,
            act_template_id: form.value.act_template_id || undefined,

            banks: form.value.banks.map(b => ({
                name: b.name,
                iban: b.iban,
                swift: b.swift || undefined
            })),

            employees: form.value.employees.length > 0
                ? form.value.employees
                    .filter(e => e.name.trim() !== '')
                    .map(e => ({
                        name: e.name,
                        role: e.role || undefined
                    }))
                : undefined
        });
        showToast('Nustatymai išsaugoti', 'success');
    } catch (err: any) {
        console.error('Save settings error:', err);
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
                                    <v-text-field v-model="form.business_name" label="Įmonės pavadinimas" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.company_code" label="Įmonės kodas" variant="outlined" density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.vat_code" label="PVM kodas"
                                        placeholder="Optional" variant="outlined" density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="12">
                                    <v-textarea v-model="form.address" label="Adresas" rows="2" variant="outlined"
                                        density="comfortable"></v-textarea>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.email" label="El. paštas"
                                        prepend-inner-icon="mdi-email-outline" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.phone" label="Telefono numeris"
                                        prepend-inner-icon="mdi-phone-outline" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                                <v-col cols="6">
                                    <v-text-field v-model="form.fax_number" label="Fakso numeris"
                                        prepend-inner-icon="mdi-fax" variant="outlined"
                                        density="comfortable"></v-text-field>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>

                    <v-card border flat class="mb-4">
                        <div class="d-flex justify-space-between align-center px-4 pt-4">
                            <div class="text-h6">Banko sąskaitos</div>
                            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-plus" @click="addBank">
                                Pridėti banką
                            </v-btn>
                        </div>
                        <v-card-text>
                            <div v-for="(bank, i) in form.banks" :key="i"
                                class="d-flex align-start mb-4 bg-grey-lighten-5 pa-3 rounded">
                                <v-row dense>
                                    <v-col cols="4">
                                        <v-text-field v-model="bank.name" label="Banko pavadinimas" density="compact"
                                            variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                    <v-col cols="5">
                                        <v-text-field v-model="bank.iban" label="Sąskaitos numeris" density="compact"
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

                    <v-card border flat class="mb-4">
                        <div class="d-flex justify-space-between align-center px-4 pt-4">
                            <div class="text-h6">Darbuotojai</div>
                            <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-plus"
                                @click="addEmployee">
                                Pridėti darbuotoją
                            </v-btn>
                        </div>
                        <v-card-subtitle class="px-4">Valdykite vardus, kurie bus prieinami "Sukūrė" laukelyje sąskaitose faktūrose</v-card-subtitle>
                        <v-card-text>
                            <div v-for="(emp, i) in form.employees" :key="i" class="d-flex align-center mb-2">
                                <v-row dense>
                                    <v-col cols="7">
                                        <v-text-field v-model="emp.name" label="Vardas" placeholder="Jonas Jonaitis"
                                            density="compact" variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                    <v-col cols="5">
                                        <v-text-field v-model="emp.role" label="Rolė (neprivaloma)" placeholder="Vadovas"
                                            density="compact" variant="outlined" hide-details></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-btn icon="mdi-delete" size="small" variant="text" color="error" class="ml-2"
                                    @click="removeEmployee(i)"></v-btn>
                            </div>
                            <div v-if="form.employees.length === 0" class="text-caption text-grey text-center py-2">
                                Darbuotojų dar nėra.
                            </div>
                        </v-card-text>
                    </v-card>

                    <v-card border flat class="mt-4">
                        <v-card-item>
                            <template v-slot:prepend>
                                <v-icon color="primary">mdi-file-document-edit-outline</v-icon>
                            </template>
                            <v-card-title>Dokumentų šablonai</v-card-title>
                            <v-card-subtitle>Įkelkite .html šablonus PDF generavimui</v-card-subtitle>
                        </v-card-item>
                        <v-divider></v-divider>

                        <v-card-text>
                            <v-row>
                                <v-col cols="12" md="6">
                                    <div class="text-subtitle-2 mb-2">Sąskaitos faktūros šablonas</div>
                                    <v-file-input label="Pasirinkite HTML failą" accept=".html" variant="outlined"
                                        density="compact" prepend-icon="" prepend-inner-icon="mdi-file-code"
                                        :loading="isUploading"
                                        @update:model-value="(files) => { if (files) { const file = Array.isArray(files) ? files[0] : files; if (file) handleFileUpload(file, 'invoice'); } }"></v-file-input>

                                    <div v-if="form.invoice_template_id"
                                        class="d-flex align-center text-caption text-success mt-n2">
                                        <v-icon size="small" start>mdi-check-circle</v-icon>
                                        Šablonas aktyvus
                                        <div class="text-grey ml-2 text-truncate" style="max-width: 150px">
                                            ({{ form.invoice_template_id }})
                                        </div>
                                    </div>
                                    <div v-else class="text-caption text-warning mt-n2">
                                        Šablonas neįkeltas.
                                    </div>
                                </v-col>

                                <v-col cols="12" md="6">
                                    <div class="text-subtitle-2 mb-2">Priėmimo-išdavimo aktas šablonas</div>
                                    <v-file-input label="Pasirinkite HTML failą" accept=".html" variant="outlined"
                                        density="compact" prepend-icon="" prepend-inner-icon="mdi-file-code"
                                        :loading="isUploading"
                                        @update:model-value="(files) => { if (files) { const file = Array.isArray(files) ? files[0] : files; if (file) handleFileUpload(file, 'act'); } }"></v-file-input>

                                    <div v-if="form.act_template_id"
                                        class="d-flex align-center text-caption text-success mt-n2">
                                        <v-icon size="small" start>mdi-check-circle</v-icon>
                                        Šablonas aktyvus
                                        <div class="text-grey ml-2 text-truncate" style="max-width: 150px">
                                            ({{ form.act_template_id }})
                                        </div>
                                    </div>
                                    <div v-else class="text-caption text-warning mt-n2">
                                        Šablonas neįkeltas.
                                    </div>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4">
                    <v-card title="Sąskaitų faktūrų numatytosios reikšmės" border flat>
                        <v-card-text>
                            <v-text-field v-model.number="form.invoice_start_number" label="Kitas sąskaitos faktūros numeris"
                                type="number" variant="outlined" density="comfortable"
                                hint="Automatiškai didėja generavimo metu" persistent-hint class="mb-4"></v-text-field>
                            <v-text-field v-model.number="form.tax_rate" label="Numatytoji PVM norma (%)" type="number"
                                variant="outlined" density="comfortable" suffix="%" class="mb-4"></v-text-field>

                            <v-text-field v-model.number="form.invoice_due_days" label="Mokėjimo terminai (dienomis)"
                                type="number" variant="outlined" density="comfortable" suffix="dienos"
                                hint="Numatytas mokėjimo terminas naujoms sąskaitoms faktūroms" persistent-hint></v-text-field>
                        </v-card-text>

                        <v-divider></v-divider>

                        <v-card-actions class="pa-4">
                            <v-btn block color="primary" size="large" variant="flat" :loading="isSaving"
                                @click="handleSave">
                                Išsaugoti pakeitimus
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </v-form>
    </div>
</template>