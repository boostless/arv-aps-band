<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

// -- COMPOSABLES --
const { trigger: showToast } = useSnackbar();

// -- QUERIES --
const showArchived = ref(false);
// Pass function for reactivity!
const { data: warehouses, isPending: isLoading } = useConvexQuery(api.warehouses.list, () => ({
    showArchived: showArchived.value
}));

const { mutate: createWarehouse, isPending: isCreating } = useConvexMutation(api.warehouses.create);
const { mutate: updateWarehouse, isPending: isUpdating } = useConvexMutation(api.warehouses.update);
const { mutate: archiveWarehouse, isPending: isArchiving } = useConvexMutation(api.warehouses.archive);

// -- STATE --
const dialog = ref(false);
const deleteDialog = ref(false);
const editingId = ref<Id<'warehouses'> | null>(null);
const itemToDelete = ref<Id<'warehouses'> | null>(null);

const form = ref({
    code: '',
    label: '',
});

// -- ACTIONS --
function openCreate() {
    editingId.value = null;
    form.value = { code: '', label: '' };
    dialog.value = true;
}

function openEdit(item: any) {
    editingId.value = item._id;
    form.value = { code: item.code, label: item.label };
    dialog.value = true;
}

function confirmArchive(id: Id<'warehouses'>) {
    itemToDelete.value = id;
    deleteDialog.value = true;
}

async function handleSubmit() {
    try {
        if (editingId.value) {
            await updateWarehouse({
                id: editingId.value,
                label: form.value.label,
                // We do not send 'code' on update
            });
            showToast('Warehouse updated', 'success');
        } else {
            await createWarehouse({
                code: form.value.code,
                label: form.value.label,
            });
            showToast('Warehouse created', 'success');
        }
        dialog.value = false;
    } catch (err: any) {
        showToast(err.toString().replace('Error: ', ''), 'error');
    }
}

async function handleArchive() {
    if (!itemToDelete.value) return;
    try {
        await archiveWarehouse({ id: itemToDelete.value });
        showToast('Warehouse archived', 'success');
        deleteDialog.value = false;
    } catch (err: any) {
        showToast('Failed to archive', 'error');
    }
}

// -- HEADERS --
const headers = [
    { title: 'Kodas', key: 'code' },
    { title: 'Sandėlio pavadinimas', key: 'label' },
    { title: 'Būsena', key: 'archived' },
    { title: 'Veiksmai', key: 'actions', sortable: false, align: 'end' as const },
];

const router = useRouter();
const handleClick = (event: any, { item }: any) => {
    router.push(`/warehouses/${item._id}`);
};
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Sandėliai</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Valdykite sandėlio vietas</div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
                Pridėti sandėlį
            </v-btn>
        </div>

        <v-switch v-model="showArchived" label="Rodyti archyvuotus" color="primary" hide-details class="mb-4"></v-switch>

        <v-card border flat>
            <v-data-table :headers="headers" :items="warehouses || []" :loading="isLoading" hover @click:row="handleClick">
                <template v-slot:item.archived="{ item }">
                    <v-chip :color="item.archived ? 'grey' : 'success'" size="small" variant="flat">
                        {{ item.archived ? 'Archyvuotas' : 'Aktyvus' }}
                    </v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                    <div v-if="!item.archived">
                        <v-btn icon="mdi-pencil" size="small" variant="text" color="primary"
                            @click="openEdit(item)"></v-btn>
                        <v-btn icon="mdi-archive" size="small" variant="text" color="orange"
                            @click="confirmArchive(item._id)"></v-btn>
                    </div>
                    <div v-else class="text-caption text-disabled">
                        Tik skaitymui
                    </div>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-title>{{ editingId ? 'Redaguoti sandėlį' : 'Naujas sandėlis' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="handleSubmit">
                        <v-row dense class="mt-2">
                            <v-col cols="12">
                                <v-text-field v-model="form.label" label="Pavadinimas" placeholder="pvz. Pagrindinis sandėlis"
                                    variant="outlined" autofocus></v-text-field>
                            </v-col>
                            <v-col cols="12">
                                <v-text-field v-model="form.code" label="Kodas" placeholder="pvz. WH-01"
                                    variant="outlined" :disabled="!!editingId" hint="Unikalus identifikatorius sandėliui"
                                    persistent-hint></v-text-field>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Atšaukti</v-btn>
                    <v-btn color="primary" variant="flat" :loading="isCreating || isUpdating" @click="handleSubmit">
                        {{ editingId ? 'Atnaujinti' : 'Sukurti' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title>Archyvuoti sandėlį?</v-card-title>
                <v-card-text>
                    Ar tikrai? Inventorius šiame sandėlyje taps neprieinamas, kol jį atkursite.
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