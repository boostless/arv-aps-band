<script setup lang="ts">
import { ref, computed } from 'vue';
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const { trigger: showToast } = useSnackbar();

// -- QUERIES & MUTATIONS --
// ✅ Changed to product_types
const { data: items } = useConvexQuery(api.product_types.list, {});

// Loading State
const isLoading = computed(() => items.value === undefined);

const { mutate: createType, isPending: isCreating } = useConvexMutation(api.product_types.create);
const { mutate: updateType, isPending: isUpdating } = useConvexMutation(api.product_types.update);
const { mutate: removeType, isPending: isDeleting } = useConvexMutation(api.product_types.remove);

// -- STATE --
const dialog = ref(false);
const deleteDialog = ref(false);
const editingId = ref<Id<'product_types'> | null>(null);
const itemToDelete = ref<Id<'product_types'> | null>(null);

// ✅ Updated Form Schema (No abbreviation)
const form = ref({
    key: '',
    label: ''
});

// -- TABLE HEADERS --
const headers = [
    { title: 'Label', key: 'label', align: 'start' as const },
    { title: 'Key', key: 'key' }, // ✅ Changed Code to Key
    { title: 'Type', key: 'is_system' },
    {
        title: 'Actions',
        key: 'actions',
        sortable: false,
        align: 'end' as const
    },
];

// -- ACTIONS --

function openCreate() {
    editingId.value = null;
    form.value = { key: '', label: '' };
    dialog.value = true;
}

function openEdit(item: any) {
    editingId.value = item._id;
    // Copy values to form
    form.value = {
        key: item.key,
        label: item.label,
    };
    dialog.value = true;
}

function confirmDelete(id: Id<'product_types'>) {
    itemToDelete.value = id;
    deleteDialog.value = true;
}

async function handleSubmit() {
    try {
        if (editingId.value) {
            // UPDATE MODE
            await updateType({
                id: editingId.value,
                label: form.value.label,
                // Note: We do not update 'key'
            });
        } else {
            // CREATE MODE
            await createType({
                key: form.value.key,
                label: form.value.label,
            });
        }
        dialog.value = false;
        showToast('Saved successfully', 'success');
    } catch (err: any) {
        showToast(err.message || 'Operation failed', 'error');
    }
}

async function handleDelete() {
    if (!itemToDelete.value) return;
    try {
        await removeType({ id: itemToDelete.value });
        deleteDialog.value = false;
        showToast('Deleted successfully', 'success');
    } catch (err: any) {
        showToast('Failed to delete: ' + err.message, 'error');
    }
}
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-6">
            <div>
                <h1 class="text-h4 font-weight-bold">Product Types</h1>
                <div class="text-subtitle-1 text-medium-emphasis">Manage categories for grouping</div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" elevation="2" @click="openCreate">
                Create Type
            </v-btn>
        </div>

        <v-card border flat>
            <v-data-table :headers="headers" :items="items || []" :loading="isLoading" hover>

                <template v-slot:item.is_system="{ item }">
                    <v-chip v-if="item.is_system" color="blue-grey" size="small" variant="flat" prepend-icon="mdi-lock">
                        System
                    </v-chip>
                    <v-chip v-else color="success" size="small" variant="tonal">
                        Custom
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
                        Protected
                    </div>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-title>{{ editingId ? 'Edit Type' : 'Add New Type' }}</v-card-title>
                <v-card-text>
                    <v-form @submit.prevent="handleSubmit">
                        <v-row dense>
                            <v-col cols="12">
                                <v-text-field v-model="form.label" label="Label (UI Name)"
                                    placeholder="e.g. Consumables" variant="outlined" density="compact"
                                    autofocus></v-text-field>
                            </v-col>

                            <v-col cols="12">
                                <v-text-field v-model="form.key" label="Key (Internal ID)"
                                    placeholder="e.g. consumables" variant="outlined" density="compact"
                                    :disabled="!!editingId" hint="Used for grouping logic. Cannot be changed."
                                    persistent-hint></v-text-field>
                            </v-col>
                        </v-row>
                    </v-form>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="flat" :loading="isCreating || isUpdating" @click="handleSubmit">
                        {{ editingId ? 'Update' : 'Create' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="deleteDialog" max-width="400">
            <v-card>
                <v-card-title class="text-h6">Delete Type?</v-card-title>
                <v-card-text>Are you sure? This might break grouping for existing products using this
                    type.</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
                    <v-btn color="error" variant="flat" :loading="isDeleting" @click="handleDelete">Delete</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>