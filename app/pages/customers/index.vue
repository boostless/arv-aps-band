<script setup lang="ts">
import { ref } from 'vue';
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const { trigger: showToast } = useSnackbar();

// -- DATA --
const showArchived = ref(false);
const { data: customers, isPending: isLoading } = useConvexQuery(api.customers.list, () => ({
    showArchived: showArchived.value
}));

// -- MUTATIONS --
const { mutate: createCustomer, isPending: isCreating } = useConvexMutation(api.customers.create);
const { mutate: updateCustomer, isPending: isUpdating } = useConvexMutation(api.customers.update);
const { mutate: archiveCustomer, isPending: isArchiving } = useConvexMutation(api.customers.archive);

// -- STATE --
const dialog = ref(false);
const deleteDialog = ref(false);
const editingId = ref<Id<'customers'> | null>(null);
const itemToDelete = ref<Id<'customers'> | null>(null);

const form = ref({
    label: '',
    code: '',
    phone: '', // <--- NEW
    email: '', // <--- NEW
    company_code: '',
    vat_code: '',
    address: '',
});

// 2. UPDATE OPEN ACTIONS
function openCreate() {
    editingId.value = null;
    form.value = {
        label: '', code: '',
        phone: '', email: '', // Reset new fields
        company_code: '', vat_code: '', address: ''
    };
    dialog.value = true;
}

function openEdit(item: any) {
    editingId.value = item._id;
    form.value = {
        label: item.label,
        code: item.code,
        phone: item.phone || '', // Load existing
        email: item.email || '', // Load existing
        company_code: item.company_code || '',
        vat_code: item.vat_code || '',
        address: item.address,
    };
    dialog.value = true;
}

function confirmArchive(id: Id<'customers'>) {
    itemToDelete.value = id;
    deleteDialog.value = true;
}

async function handleArchive() {
    if (!itemToDelete.value) return;
    try {
        await archiveCustomer({ id: itemToDelete.value });
        showToast('Klientas archyvuotas', 'success');
        deleteDialog.value = false;
    } catch (err: any) {
        showToast('Nepavyko archyvuoti kliento', 'error');
    }
}

// 3. UPDATE SUBMIT
async function handleSubmit() {
    try {
        const payload = {
            label: form.value.label,
            code: form.value.code,
            // Pass undefined if empty string to keep DB clean
            phone: form.value.phone || undefined,
            email: form.value.email || undefined,
            company_code: form.value.company_code || undefined,
            vat_code: form.value.vat_code || undefined,
            address: form.value.address,
            archived: false,
        };

        if (editingId.value) {
            await updateCustomer({ id: editingId.value, ...payload });
            showToast('Klientas atnaujintas', 'success');
        } else {
            await createCustomer(payload);
            showToast('Klientas sukurtas', 'success');
        }
        dialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

// 4. UPDATE HEADERS (Added Contact column)
const headers = [
    { title: 'Kodas', key: 'code' },
    { title: 'Klientas', key: 'label' },
    { title: 'Kontaktai', key: 'contact', sortable: false }, // <--- NEW
    { title: 'Įmonės duomenys', key: 'company_code' },     // Renamed for clarity
    { title: 'Veiksmai', key: 'actions', sortable: false, align: 'end' as const },
];
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Klientai</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Valdykite klientų duomenų bazę</div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
                Pridėti klientą
            </v-btn>
        </div>

        <v-switch v-model="showArchived" label="Rodyti archyvuotus" color="primary" hide-details
            class="mb-4"></v-switch>

        <v-card border flat>
            <v-data-table :headers="headers" :items="customers || []" :loading="isLoading" hover>

                <template v-slot:item.contact="{ item }">
                    <div v-if="item.email" class="d-flex align-center text-caption">
                        <v-icon size="small" class="mr-1 text-medium-emphasis">mdi-email</v-icon>
                        {{ item.email }}
                    </div>
                    <div v-if="item.phone" class="d-flex align-center text-caption text-grey-darken-1">
                        <v-icon size="small" class="mr-1 text-medium-emphasis">mdi-phone</v-icon>
                        {{ item.phone }}
                    </div>
                    <div v-if="!item.email && !item.phone" class="text-disabled text-caption">-</div>
                </template>

                <template v-slot:item.company_code="{ item }">
                    <div v-if="item.company_code">{{ item.company_code }}</div>
                    <div v-if="item.vat_code" class="text-caption text-medium-emphasis">VAT: {{ item.vat_code }}</div>
                </template>

                <template v-slot:item.actions="{ item }">
                    <v-btn icon="mdi-eye-outline" size="small" variant="text" color="primary"
                        :to="`/customers/${item._id}`">
                        <v-icon>mdi-eye-outline</v-icon>
                        <v-tooltip activator="parent" location="top">Peržiūrėti istoriją</v-tooltip></v-btn>
                    <v-btn icon="mdi-pencil" size="small" variant="text" color="primary"
                        @click="openEdit(item)"></v-btn>
                    <v-btn icon="mdi-archive" size="small" variant="text" color="orange"
                        @click="confirmArchive(item._id)"></v-btn>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="600">
            <v-card>
                <v-card-title>{{ editingId ? 'Edit Customer' : 'New Customer' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="handleSubmit">
                        <v-row dense class="mt-2">
                            <v-col cols="8">
                                <v-text-field v-model="form.label" label="Customer Name" variant="outlined"
                                    autofocus></v-text-field>
                            </v-col>
                            <v-col cols="4">
                                <v-text-field v-model="form.code" label="Code" variant="outlined"
                                    :disabled="!!editingId"></v-text-field>
                            </v-col>

                            <v-col cols="6">
                                <v-text-field v-model="form.email" label="Email" prepend-inner-icon="mdi-email-outline"
                                    variant="outlined" density="compact"></v-text-field>
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model="form.phone" label="Phone Number"
                                    prepend-inner-icon="mdi-phone-outline" variant="outlined"
                                    density="compact"></v-text-field>
                            </v-col>

                            <v-col cols="6">
                                <v-text-field v-model="form.company_code" label="Company Code" variant="outlined"
                                    density="compact"></v-text-field>
                            </v-col>
                            <v-col cols="6">
                                <v-text-field v-model="form.vat_code" label="VAT Code" variant="outlined"
                                    density="compact"></v-text-field>
                            </v-col>
                            <v-col cols="12">
                                <v-textarea v-model="form.address" label="Address" rows="2" variant="outlined"
                                    density="compact"></v-textarea>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :loading="isCreating || isUpdating"
                        @click="handleSubmit">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>Archive Customer?</v-card-title>
                <v-card-text>Are you sure? This will hide the customer from selections.</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="orange" variant="flat" :loading="isArchiving" @click="handleArchive">Archive</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>