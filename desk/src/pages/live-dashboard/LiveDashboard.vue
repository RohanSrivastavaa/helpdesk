<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <span class="text-lg font-medium text-gray-900">Live Dashboard</span>
          <!-- pulse dot -->
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        </div>
      </template>
      <template #right-header>
        <span class="text-xs text-ink-gray-4">
          Auto-refreshes every 30s · Last: {{ lastRefreshed }}
        </span>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

      <!-- Loading skeleton -->
      <div v-if="loading && !data" class="flex items-center justify-center h-40 text-ink-gray-4">
        Loading…
      </div>

      <template v-else-if="data">

        <!-- ── Summary cards ──────────────────────────────────────── -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1"
          >
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">
              {{ card.label }}
            </span>
            <span class="text-3xl font-bold" :class="card.valueClass || 'text-ink-gray-9'">
              {{ card.value }}
            </span>
            <span v-if="card.sub" class="text-xs text-ink-gray-4">{{ card.sub }}</span>
          </div>
        </div>

        <!-- ── Status & Priority breakdown ───────────────────────── -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <!-- By Status -->
          <div class="rounded-xl border bg-surface-white p-4">
            <h3 class="text-sm font-semibold text-ink-gray-7 mb-3">Open Tickets by Status</h3>
            <div v-if="data.by_status.length" class="flex flex-col gap-2">
              <div
                v-for="row in data.by_status"
                :key="row.status"
                class="flex items-center gap-3"
              >
                <span class="w-28 text-sm text-ink-gray-7 truncate">{{ row.status }}</span>
                <div class="flex-1 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                  <div
                    class="h-2 rounded-full bg-blue-500 transition-all"
                    :style="{ width: barWidth(row.count, maxStatusCount) }"
                  />
                </div>
                <span class="w-6 text-right text-sm font-semibold text-ink-gray-8">
                  {{ row.count }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-ink-gray-4">No open tickets</p>
          </div>

          <!-- By Priority -->
          <div class="rounded-xl border bg-surface-white p-4">
            <h3 class="text-sm font-semibold text-ink-gray-7 mb-3">Open Tickets by Priority</h3>
            <div v-if="data.by_priority.length" class="flex flex-col gap-2">
              <div
                v-for="row in data.by_priority"
                :key="row.priority"
                class="flex items-center gap-3"
              >
                <span
                  class="w-16 text-xs font-semibold px-2 py-0.5 rounded-full text-center"
                  :class="priorityClass(row.priority)"
                >
                  {{ row.priority || '—' }}
                </span>
                <div class="flex-1 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                  <div
                    class="h-2 rounded-full transition-all"
                    :class="priorityBarClass(row.priority)"
                    :style="{ width: barWidth(row.count, maxPriorityCount) }"
                  />
                </div>
                <span class="w-6 text-right text-sm font-semibold text-ink-gray-8">
                  {{ row.count }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-ink-gray-4">No open tickets</p>
          </div>
        </div>

        <!-- ── Agent Workload table ───────────────────────────────── -->
        <div class="rounded-xl border overflow-hidden bg-surface-white">
          <div class="px-4 py-3 border-b bg-surface-gray-1 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-ink-gray-7">Agent Workload</h3>
            <span class="text-xs text-ink-gray-4">
              {{ data.agent_workload.filter(a => a.agent_status === 'Online').length }} online
            </span>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-surface-gray-1">
                <th class="px-4 py-2 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">Agent</th>
                <th class="px-4 py-2 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">Status</th>
                <th class="px-4 py-2 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">Open Tickets</th>
                <th class="px-4 py-2 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide w-48">Load</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="agent in data.agent_workload"
                :key="agent.agent"
                class="border-b last:border-0 hover:bg-surface-gray-1 transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                      :style="{ backgroundColor: avatarColor(agent.user) }"
                    >
                      {{ initials(agent.full_name) }}
                    </span>
                    <div class="flex flex-col">
                      <span class="font-medium text-ink-gray-8">{{ agent.full_name }}</span>
                      <span class="text-xs text-ink-gray-4">{{ agent.user }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                    :class="agentStatusClass(agent.agent_status)"
                  >
                    <span class="h-1.5 w-1.5 rounded-full" :class="agentStatusDot(agent.agent_status)" />
                    {{ agent.agent_status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="font-semibold"
                    :class="agent.open_count > 10 ? 'text-red-600' : agent.open_count > 5 ? 'text-amber-600' : 'text-ink-gray-8'"
                  >
                    {{ agent.open_count }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="w-36 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                    <div
                      class="h-2 rounded-full transition-all"
                      :class="agent.open_count > 10 ? 'bg-red-500' : agent.open_count > 5 ? 'bg-amber-500' : 'bg-green-500'"
                      :style="{ width: barWidth(agent.open_count, maxAgentLoad) }"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="!data.agent_workload.length"
            class="flex flex-col items-center justify-center py-12 text-ink-gray-4 gap-2"
          >
            <FeatherIcon name="users" class="h-8 w-8" />
            <p class="text-sm">No agents found</p>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { socket } from "@/socket";
import { call, FeatherIcon } from "frappe-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";

// ── Types ──────────────────────────────────────────────────────────────────
interface StatusRow   { status: string;   count: number }
interface PriorityRow { priority: string; count: number }
interface AgentRow {
  agent: string;
  user: string;
  full_name: string;
  user_image: string | null;
  agent_status: string;
  open_count: number;
}
interface LiveData {
  open_tickets: number;
  queue_depth: number;
  agents_online: number;
  avg_wait_sec: number | null;
  by_status: StatusRow[];
  by_priority: PriorityRow[];
  agent_workload: AgentRow[];
}

// ── State ──────────────────────────────────────────────────────────────────
const data    = ref<LiveData | null>(null);
const loading = ref(false);
const lastRefreshed = ref("—");

// ── Fetch ──────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.live_dashboard.get_live_stats"
    );
    lastRefreshed.value = new Date().toLocaleTimeString();
  } finally {
    loading.value = false;
  }
}

// ── Auto-refresh every 30 s ────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  load();
  refreshTimer = setInterval(load, 30_000);

  // Also refresh on realtime events that affect stats
  socket.on("agent_status_changed", load);
  socket.on("helpdesk:ticket-update", load);
  socket.on("whatsapp_message", load);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  socket.off("agent_status_changed", load);
  socket.off("helpdesk:ticket-update", load);
  socket.off("whatsapp_message", load);
});

// ── Summary cards ──────────────────────────────────────────────────────────
const summaryCards = computed(() => {
  const d = data.value;
  if (!d) return [];
  return [
    {
      label: "Open Tickets",
      value: d.open_tickets,
      sub: "currently active",
      valueClass: d.open_tickets > 50 ? "text-red-600" : "text-ink-gray-9",
    },
    {
      label: "Queue Depth",
      value: d.queue_depth,
      sub: "unassigned",
      valueClass: d.queue_depth > 10 ? "text-red-600" : d.queue_depth > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      label: "Agents Online",
      value: d.agents_online,
      sub: "available now",
      valueClass: d.agents_online === 0 ? "text-red-600" : "text-green-600",
    },
    {
      label: "Avg Wait Time",
      value: d.avg_wait_sec != null ? formatDuration(d.avg_wait_sec) : "—",
      sub: "since ticket created",
      valueClass: d.avg_wait_sec != null && d.avg_wait_sec > 14400 ? "text-red-600" : "text-ink-gray-9",
    },
  ];
});

// ── Bar chart helpers ──────────────────────────────────────────────────────
const maxStatusCount = computed(() =>
  Math.max(1, ...( data.value?.by_status.map(r => r.count) ?? [1]))
);
const maxPriorityCount = computed(() =>
  Math.max(1, ...(data.value?.by_priority.map(r => r.count) ?? [1]))
);
const maxAgentLoad = computed(() =>
  Math.max(1, ...(data.value?.agent_workload.map(r => r.open_count) ?? [1]))
);

function barWidth(val: number, max: number): string {
  if (!max) return "0%";
  return `${Math.round((val / max) * 100)}%`;
}

// ── Styles ─────────────────────────────────────────────────────────────────
function priorityClass(p: string): string {
  return {
    Urgent: "bg-red-100 text-red-700",
    High:   "bg-orange-100 text-orange-700",
    Medium: "bg-amber-100 text-amber-700",
    Low:    "bg-green-100 text-green-700",
  }[p] ?? "bg-surface-gray-2 text-ink-gray-6";
}

function priorityBarClass(p: string): string {
  return {
    Urgent: "bg-red-500",
    High:   "bg-orange-500",
    Medium: "bg-amber-500",
    Low:    "bg-green-500",
  }[p] ?? "bg-blue-500";
}

function agentStatusClass(s: string): string {
  return {
    Online:      "bg-green-100 text-green-700",
    "On Break":  "bg-amber-100 text-amber-700",
    Lunch:       "bg-orange-100 text-orange-700",
    "In Training": "bg-blue-100 text-blue-700",
    Offline:     "bg-surface-gray-2 text-ink-gray-5",
  }[s] ?? "bg-surface-gray-2 text-ink-gray-5";
}

function agentStatusDot(s: string): string {
  return {
    Online:      "bg-green-500",
    "On Break":  "bg-amber-500",
    Lunch:       "bg-orange-500",
    "In Training": "bg-blue-500",
    Offline:     "bg-ink-gray-4",
  }[s] ?? "bg-ink-gray-4";
}

// ── Formatters ─────────────────────────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b",
  "#10b981","#3b82f6","#ef4444","#14b8a6",
];

function avatarColor(email: string): string {
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}
</script>
