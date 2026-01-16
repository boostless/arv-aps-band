<script setup lang="ts">
import { api } from '~~/convex/_generated/api';
import type { Id } from '~~/convex/_generated/dataModel';

const props = defineProps<{
    modelValue: boolean
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>();

const { data: notifications } = useConvexQuery(api.notifications.list, {});
const { mutate: remove } = useConvexMutation(api.notifications.remove);

const router = useRouter();

// Local storage for read notifications (per device)
const readNotifications = ref<string[]>([]);

onMounted(() => {
    const stored = localStorage.getItem('readNotifications');
    if (stored) {
        readNotifications.value = JSON.parse(stored);
    }
});

// Computed property to determine if notification is read locally
const enrichedNotifications = computed(() => {
    if (!notifications.value) return [];
    return notifications.value.map(notif => ({
        ...notif,
        isReadLocally: readNotifications.value.includes(notif._id)
    }));
});

// Computed unread count (for badge)
const unreadCount = computed(() => {
    return enrichedNotifications.value.filter(n => !n.isReadLocally).length;
});

// Expose unread count to parent
defineExpose({ unreadCount });

function formatTime(timestamp: number) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ką tik';
    if (minutes < 60) return `Prieš ${minutes} min.`;
    if (hours < 24) return `Prieš ${hours} val.`;
    return `Prieš ${days} d.`;
}

function getIcon(type: string) {
    switch (type) {
        case 'invoice_created': return 'mdi-receipt-text';
        case 'invoice_paid': return 'mdi-cash-check';
        case 'order_created': return 'mdi-file-document-plus';
        case 'order_completed': return 'mdi-check-circle';
        default: return 'mdi-information';
    }
}

function getColor(type: string) {
    switch (type) {
        case 'invoice_created': return 'blue';
        case 'invoice_paid': return 'success';
        case 'order_created': return 'orange';
        case 'order_completed': return 'success';
        default: return 'grey';
    }
}

function markAsReadLocally(notificationId: string) {
    if (!readNotifications.value.includes(notificationId)) {
        readNotifications.value.push(notificationId);
        localStorage.setItem('readNotifications', JSON.stringify(readNotifications.value));
    }
}

function handleClick(notif: any) {
    // Mark as read locally
    markAsReadLocally(notif._id);

    // Navigate to relevant page
    if (notif.invoice_id) {
        router.push(`/invoices/${notif.invoice_id}`);
        emit('update:modelValue', false);
    } else if (notif.order_id) {
        router.push(`/orders/${notif.order_id}`);
        emit('update:modelValue', false);
    }
}

async function handleDelete(id: Id<'notifications'>, event: Event) {
    event.stopPropagation();
    // Remove from local storage too
    readNotifications.value = readNotifications.value.filter(nid => nid !== id);
    localStorage.setItem('readNotifications', JSON.stringify(readNotifications.value));
    await remove({ id });
}

function handleMarkAllRead() {
    if (!notifications.value) return;
    const allIds = notifications.value.map(n => n._id);
    readNotifications.value = [...new Set([...readNotifications.value, ...allIds])];
    localStorage.setItem('readNotifications', JSON.stringify(readNotifications.value));
}
</script>

<template>
    <v-navigation-drawer :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" location="right"
        temporary width="400">
        <div class="d-flex align-center justify-space-between pa-4 border-b">
            <div class="text-h6 font-weight-bold">Pranešimai</div>
            <v-btn v-if="enrichedNotifications && enrichedNotifications.some(n => !n.isReadLocally)" variant="text" size="small" color="primary"
                @click="handleMarkAllRead">
                Pažymėti viską
            </v-btn>
        </div>

        <v-list v-if="enrichedNotifications && enrichedNotifications.length > 0" lines="two">
            <v-list-item v-for="notif in enrichedNotifications" :key="notif._id" @click="handleClick(notif)"
                :class="{ 'bg-blue-lighten-5': !notif.isReadLocally }" class="border-b">
                <template v-slot:prepend>
                    <v-avatar :color="getColor(notif.type)" size="40">
                        <v-icon :icon="getIcon(notif.type)" color="white"></v-icon>
                    </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium">
                    {{ notif.title }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-wrap">
                    {{ notif.message }}
                </v-list-item-subtitle>

                <template v-slot:append>
                    <div class="d-flex flex-column align-end">
                        <div class="text-caption text-grey mb-2">{{ formatTime(notif.created_at) }}</div>
                        <v-btn icon="mdi-close" size="x-small" variant="text" @click="(e: any) => handleDelete(notif._id, e)"></v-btn>
                    </div>
                </template>
            </v-list-item>
        </v-list>

        <div v-else class="d-flex flex-column align-center justify-center pa-8 text-center" style="height: 80vh;">
            <v-icon icon="mdi-bell-outline" size="64" color="grey-lighten-1" class="mb-4"></v-icon>
            <div class="text-h6 text-grey">Pranešimų nėra</div>
            <div class="text-body-2 text-grey">Visi pranešimai bus rodomi čia</div>
        </div>
    </v-navigation-drawer>
</template>
