<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';
const { trigger: showToast } = useSnackbar();
// -- QUERIES & MUTATIONS --
const { data: units } = useConvexQuery(api.units.list, {});
// Fix: Calculate loading state manually
const isLoading = computed(() => units.value === undefined);

const { mutate: createUnit, isPending: isCreating } = useConvexMutation(api.units.create);
const { mutate: updateUnit, isPending: isUpdating } = useConvexMutation(api.units.update);
const { mutate: removeUnit, isPending: isDeleting } = useConvexMutation(api.units.remove);

// -- STATE --
const dialog = ref(false);
const deleteDialog = ref(false);
const editingId = ref<Id<'units'> | null>(null);
const itemToDelete = ref<Id<'units'> | null>(null);

const form = ref({
    code: '',
    label: '',
    abbreviation: ''
});

// -- TABLE HEADERS --
const headers = [
    { title: 'Kodas', key: 'code' },
    { title: 'Pavadinimas', key: 'label', align: 'start' as const },
    { title: 'Santrumpa', key: 'abbreviation' },
    { title: 'Tipas', key: 'is_system' },
    {
        title: 'Veiksmai',
        key: 'actions',
        sortable: false,
        align: 'end' as const  // <--- ADD THIS
    },
];

// -- ACTIONS --

function openCreate() {
    editingId.value = null;
    form.value = { code: '', label: '', abbreviation: '' };
    dialog.value = true;
}

function openEdit(item: any) {
    editingId.value = item._id;
    // Copy values to form
    form.value = {
        code: item.code,
        label: item.label,
        abbreviation: item.abbreviation
    };
    dialog.value = true;
}

function confirmDelete(id: Id<'units'>) {
    itemToDelete.value = id;
    deleteDialog.value = true;
}

async function handleSubmit() {
    try {
        if (editingId.value) {
            // UPDATE MODE
            await updateUnit({
                id: editingId.value,
                label: form.value.label,
                abbreviation: form.value.abbreviation,
                // We generally don't update 'code' to avoid breaking relations
            });
        } else {
            // CREATE MODE
            await createUnit({
                code: form.value.code,
                label: form.value.label,
                abbreviation: form.value.abbreviation
            });
        }
        dialog.value = false;
    } catch (err: any) {
        showToast(err.message || 'Operation failed', 'error');
    }
}

async function handleDelete() {
    if (!itemToDelete.value) return;
    try {
        await removeUnit({ id: itemToDelete.value });
        deleteDialog.value = false;
    } catch (err: any) {
        showToast('Failed to delete: ' + err.message, 'error');
    }
}
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Vienetai</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Valdykite matavimo vienetus</div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" elevation="2" @click="openCreate">
                Pridėti vienetą
            </v-btn>
        </div>

        <v-card border flat>
            <v-data-table :headers="headers" :items="units || []" :loading="isLoading" hover>
                <template v-slot:item.is_system="{ item }">
                    <v-chip v-if="item.is_system" color="blue-grey" size="small" variant="flat" prepend-icon="mdi-lock">
                        Sisteminis
                    </v-chip>
                    <v-chip v-else color="success" size="small" variant="tonal">
                        Nestandartinis
                    </v-chip>
                </template>

                <template v-slot:item.actions="{ item }">
                    <div v-if="!item.is_system">
                        <v-btn icon="mdi-pencil" size="small" variant="text" color="primary"
                            @click="openEdit(item)"></v-btn>
                        <v-btn icon="mdi-delete" size="small" variant="text" color="error"
                            @click="confirmDelete(item._id)"></v-btn>
                    </div>
                    <div v-else class="text-caption text-disabled font-italic">
                        Apsaugotas
                    </div>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-title>{{ editingId ? 'Redaguoti vienetą' : 'Naujas vienetas' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="handleSubmit">
                        <v-row dense>
                            <v-col cols="12">
                                <v-text-field v-model="form.label" label="Pavadinimas" variant="outlined" density="compact"
                                    autofocus></v-text-field>
                            </v-col>

                            <v-col cols="6">
                                <v-text-field v-model="form.code" label="Kodas" variant="outlined" density="compact"
                                    :disabled="!!editingId" hint="Negalima keisti po sukūrimo"
                                    persistent-hint></v-text-field>
                            </v-col>

                            <v-col cols="6">
                                <v-text-field v-model="form.abbreviation" label="Santrumpa" variant="outlined"
                                    density="compact"></v-text-field>
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
                <v-card-title class="text-h6">Ištrinti vienetą?</v-card-title>
                <v-card-text>Ar tikrai norite ištrinti šį vienetą? Šio veiksmo atšaukti negalima.</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog = false">Atšaukti</v-btn>
                    <v-btn color="error" variant="flat" :loading="isDeleting" @click="handleDelete">Ištrinti</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>