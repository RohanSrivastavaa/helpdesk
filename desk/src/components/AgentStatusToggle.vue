<template>
  <Dropdown :options="statusOptions" placement="bottom-end">
    <template #default="{ open }">
      <button
        class="inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-base font-medium transition-colors focus:outline-none shrink-0 text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4"
        :disabled="isLoading"
      >
        <span
          class="h-2 w-2 flex-shrink-0 rounded-full transition-colors"
          :style="{ backgroundColor: statusColor }"
        />
        <span class="hidden max-w-[120px] truncate sm:block">
          {{ currentStatus }}<template v-if="duration"> · {{ duration }}</template>
        </span>
        <FeatherIcon
          name="chevron-down"
          class="h-3 w-3 flex-shrink-0 text-ink-gray-5"
        />
      </button>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { STATUS_COLOR, STATUS_OPTIONS, useAgentStatusStore } from "@/stores/agentStatus";
import { socket } from "@/socket";
import { Dropdown, toast } from "frappe-ui";
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref } from "vue";

const store = useAgentStatusStore();
const { currentStatus, statusChangedAt, isLoading } = storeToRefs(store);

const statusColor = computed(() => STATUS_COLOR[currentStatus.value] ?? "#9ca3af");

const statusOptions = computed(() =>
  STATUS_OPTIONS.map((s) => ({
    label: s.label,
    onClick: () => store.setStatus(s.value),
  }))
);

// Feature 6: live duration "2h 15m" since last status change
const now = ref(Date.now());
let durationTimer: ReturnType<typeof setInterval> | null = null;

const duration = computed(() => {
  if (!statusChangedAt.value) return null;
  const diffMs = now.value - new Date(statusChangedAt.value).getTime();
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return null; // don't show for < 1 min
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
});

// Feature 8: ticket assignment notification
function onTicketAssigned(data: { ticket: string; subject: string }) {
  toast.create({
    message: `New ticket assigned — #${data.ticket}: ${data.subject}`,
    type: "info",
  });
}

// SLA breach alert
function onSlaBreachAlert(data: {
  ticket: string;
  subject: string;
  breach_type: string;
}) {
  toast.create({
    message: `SLA Breach: ${data.breach_type} overdue — #${data.ticket}: ${data.subject}`,
    type: "warning",
  });
}

// Escalation alert
function onEscalationAlert(data: { ticket: string; subject: string; message: string }) {
  toast.create({
    message: data.message || `⚠️ Escalated — #${data.ticket}: ${data.subject}`,
    type: "warning",
  });
}

// Snooze expired
function onTicketUnsnoozed(data: { ticket: string }) {
  toast.create({
    message: `⏰ Ticket #${data.ticket} is back — snooze expired`,
    type: "info",
  });
}

// @Mention notification
function onMentionNotification(data: { ticket: string; from: string; message: string }) {
  toast.create({
    message: `💬 ${data.message || `${data.from} mentioned you in ticket #${data.ticket}`}`,
    type: "info",
  });
}

onMounted(() => {
  store.fetchStatus();
  store.subscribeToUpdates();
  store.setupBeforeUnload();

  // Feature 6: update clock every 30s
  durationTimer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);

  // Feature 8
  socket.on("ticket_assigned", onTicketAssigned);
  socket.on("sla_breach_alert", onSlaBreachAlert);
  socket.on("escalation_alert", onEscalationAlert);
  socket.on("ticket_unsnoozed", onTicketUnsnoozed);
  socket.on("mention_notification", onMentionNotification);
});

onUnmounted(() => {
  store.unsubscribeFromUpdates();
  if (durationTimer) clearInterval(durationTimer);
  socket.off("ticket_assigned", onTicketAssigned);
  socket.off("sla_breach_alert", onSlaBreachAlert);
  socket.off("escalation_alert", onEscalationAlert);
  socket.off("ticket_unsnoozed", onTicketUnsnoozed);
  socket.off("mention_notification", onMentionNotification);
});
</script>
