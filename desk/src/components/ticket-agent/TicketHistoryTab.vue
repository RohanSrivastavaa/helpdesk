<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Header row -->
    <div class="flex items-center justify-between border-b px-5 py-3">
      <div>
        <p class="text-sm font-medium text-ink-gray-8">
          {{ tickets.length }} past ticket{{ tickets.length !== 1 ? "s" : "" }}
        </p>
        <p class="text-xs text-ink-gray-4">Same customer (email or WA)</p>
      </div>
      <button
        class="text-xs text-ink-gray-4 hover:text-ink-gray-7"
        :disabled="loading"
        @click="fetchHistory"
      >
        ↻ Refresh
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center py-8">
      <span class="text-sm text-ink-gray-4">Loading…</span>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!tickets.length"
      class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center"
    >
      <span class="text-2xl">📭</span>
      <p class="text-sm text-ink-gray-5">No previous tickets found</p>
    </div>

    <!-- List -->
    <div v-else class="flex-1 overflow-y-auto divide-y">
      <div
        v-for="t in tickets"
        :key="t.name"
        class="cursor-pointer px-5 py-3 hover:bg-surface-gray-1 transition-colors"
        @click="openTicket(t.name)"
      >
        <!-- Ticket ID + status badge -->
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="text-xs font-mono text-ink-gray-5">#{{ t.name }}</span>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            :class="statusClass(t.status_color)"
          >
            {{ t.status }}
          </span>
        </div>

        <!-- Subject -->
        <p class="text-sm font-medium text-ink-gray-8 leading-snug line-clamp-2">
          {{ t.subject }}
        </p>

        <!-- Meta row -->
        <div class="mt-1 flex items-center gap-3 text-xs text-ink-gray-4">
          <span>{{ fmtDate(t.creation) }}</span>
          <span v-if="t.ticket_source" class="flex items-center gap-0.5">
            <span>{{ sourceIcon(t.ticket_source) }}</span>
            {{ t.ticket_source }}
          </span>
          <span v-if="t.priority" class="flex items-center gap-0.5">
            <span :class="priorityDot(t.priority)" class="h-1.5 w-1.5 rounded-full inline-block" />
            {{ t.priority }}
          </span>
          <span v-if="t.csat_stars" class="text-amber-500">
            {{ "⭐".repeat(t.csat_stars) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call } from "frappe-ui";
import { inject, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { TicketSymbol } from "@/types";

const ticket = inject(TicketSymbol);
const router = useRouter();

interface HistoryTicket {
  name: string;
  subject: string;
  status: string;
  status_color: string;
  priority: string;
  ticket_source: string;
  creation: string;
  csat_stars: number | null;
}

const tickets = ref<HistoryTicket[]>([]);
const loading = ref(false);

async function fetchHistory() {
  loading.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.customer_history.get_customer_ticket_history",
      { ticket_name: ticket.value.doc.name }
    );
    tickets.value = result || [];
  } catch {
    tickets.value = [];
  } finally {
    loading.value = false;
  }
}

function openTicket(name: string) {
  router.push({ name: "TicketAgent", params: { ticketId: name } });
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceIcon(source: string) {
  const icons: Record<string, string> = {
    WhatsApp: "💬",
    Email: "✉️",
    Phone: "📞",
    Portal: "🌐",
  };
  return icons[source] || "";
}

function priorityDot(priority: string) {
  const classes: Record<string, string> = {
    Urgent: "bg-red-500",
    High: "bg-orange-400",
    Medium: "bg-amber-400",
    Low: "bg-green-400",
  };
  return classes[priority] || "bg-gray-300";
}

function statusClass(color: string) {
  const classes: Record<string, string> = {
    blue:  "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    gray:  "bg-surface-gray-2 text-ink-gray-5",
  };
  return classes[color] || classes.gray;
}

onMounted(() => {
  fetchHistory();
});
</script>
