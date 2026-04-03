<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideUsers class="h-4 w-4 text-ink-gray-5" />
          <span class="text-base font-semibold text-ink-gray-9">Live Agent Board</span>
          <span class="text-xs text-ink-gray-4 tabular-nums">— {{ lastRefreshed }}</span>
        </div>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <div class="flex rounded-md border border-outline-gray-2 overflow-hidden text-xs">
            <button
              v-for="f in statusFilters"
              :key="f.value"
              class="px-3 py-1.5 transition-colors"
              :class="activeFilter === f.value
                ? 'bg-ink-gray-8 text-white font-medium'
                : 'bg-white text-ink-gray-6 hover:bg-surface-gray-1'"
              @click="activeFilter = f.value">
              {{ f.label }}
              <span class="ml-1 opacity-60">{{ filterCount(f.value) }}</span>
            </button>
          </div>
          <span class="text-xs text-ink-gray-3 tabular-nums">
            <LucideTimer class="inline h-3 w-3 mr-0.5" />{{ countdownLabel }}
          </span>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-outline-gray-2 bg-white text-ink-gray-7 text-xs font-medium hover:bg-surface-gray-1 transition-colors"
            @click="load">
            <LucideRefreshCw class="h-3 w-3" :class="{ 'animate-spin': loading }" />
            Refresh
          </button>
        </div>
      </template>
    </LayoutHeader>

    <!-- Team summary strip -->
    <div v-if="summary" class="flex items-center gap-6 px-6 py-3 border-b border-outline-gray-2 bg-white text-sm">
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9">{{ summary.online_agents }}</span>
        <span class="text-ink-gray-5">online</span>
        <span class="text-ink-gray-3 ml-1">/ {{ agents.length }}</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9">{{ summary.open_count }}</span>
        <span class="text-ink-gray-5">open tickets</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span
          class="font-semibold tabular-nums"
          :class="summary.unassigned_count > 0 ? 'text-red-600' : 'text-ink-gray-9'">
          {{ summary.unassigned_count }}
        </span>
        <span class="text-ink-gray-5">unassigned</span>
        <span v-if="summary.unassigned_count > 0 && summary.oldest_unassigned"
          class="text-xs text-ink-gray-4">(oldest {{ oldestAge }})</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-auto px-6 py-5">
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin border-ink-gray-4" />
        <p class="text-sm text-ink-gray-5">Loading…</p>
      </div>

      <div v-else-if="!agents.length" class="flex flex-col items-center justify-center h-48 gap-2 text-ink-gray-4">
        <LucideUsers class="h-10 w-10 opacity-30" />
        <p class="text-sm">No agents found</p>
      </div>

      <div v-else class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(190px, 1fr))">
        <div
          v-for="agent in filteredAgents"
          :key="agent.user"
          class="bg-white rounded-lg border p-4 flex flex-col items-center gap-2.5 transition-shadow hover:shadow-sm"
          :class="agent.open_tickets >= 25 ? 'border-red-200' : 'border-outline-gray-2'">
          <!-- Avatar -->
          <div class="relative">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
              :style="`background:${avatarColor(agent.full_name)}`">
              {{ initials(agent.full_name) }}
            </div>
            <span
              class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
              :style="`background:${statusDot(agent.status)}`" />
          </div>
          <!-- Name -->
          <div class="text-center min-w-0 w-full">
            <p class="font-medium text-ink-gray-9 text-sm leading-tight truncate">{{ agent.full_name }}</p>
            <p class="text-xs text-ink-gray-4 mt-0.5">{{ durationLabel(agent.last_updated) }}</p>
          </div>
          <!-- Ticket count -->
          <div class="w-full flex items-center justify-between text-xs border-t border-outline-gray-2 pt-2 mt-0.5">
            <span class="text-ink-gray-5">Open tickets</span>
            <span
              class="font-semibold tabular-nums"
              :class="agent.open_tickets >= 20 ? 'text-red-600' : agent.open_tickets >= 10 ? 'text-amber-600' : 'text-ink-gray-8'">
              {{ agent.open_tickets }}
              <span v-if="agent.open_tickets >= 25" class="ml-0.5 text-red-500">!</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { socket } from "@/socket";
import { call } from "frappe-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideTimer from "~icons/lucide/timer";
import LucideUsers from "~icons/lucide/users";

interface AgentStatus {
  agent: string; user: string; full_name: string;
  user_image: string | null; status: string; last_updated: string | null;
  open_tickets: number;
}

interface TeamSummary {
  open_count: number; unassigned_count: number;
  oldest_unassigned: string | null; online_agents: number;
}

const agents = ref<AgentStatus[]>([]);
const summary = ref<TeamSummary | null>(null);
const loading = ref(false);
const now = ref(new Date());
const lastRefreshed = ref("—");
const activeFilter = ref("All");

const statusFilters = [
  { label: "All",     value: "All"     },
  { label: "Online",  value: "Online"  },
  { label: "Away",    value: "Away"    },
  { label: "Offline", value: "Offline" },
];

function statusGroup(s: string): "Online" | "Away" | "Offline" {
  if (s === "Online") return "Online";
  if (s === "Offline") return "Offline";
  return "Away";
}

const filteredAgents = computed(() => {
  const sorted = [...agents.value].sort((a, b) => {
    const order = ["Online", "Away", "Offline"];
    return order.indexOf(statusGroup(a.status)) - order.indexOf(statusGroup(b.status))
      || a.open_tickets - b.open_tickets === 0
      ? a.full_name.localeCompare(b.full_name)
      : b.open_tickets - a.open_tickets;
  });
  if (activeFilter.value === "All") return sorted;
  return sorted.filter((a) => statusGroup(a.status) === activeFilter.value);
});

function filterCount(f: string): number {
  if (f === "All") return agents.value.length;
  return agents.value.filter((a) => statusGroup(a.status) === f).length;
}

const STATUS_DOTS: Record<string, string> = {
  Online: "#22c55e",
  "On Break": "#f59e0b",
  Lunch: "#f97316",
  "In Training": "#3b82f6",
  Offline: "#d1d5db",
};

function statusDot(s: string): string {
  return STATUS_DOTS[s] ?? "#d1d5db";
}

const oldestAge = computed(() => {
  if (!summary.value?.oldest_unassigned) return "";
  const diffMs = now.value.getTime() - new Date(summary.value.oldest_unassigned).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
});

async function load() {
  loading.value = true;
  countdown.value = INTERVAL;
  try {
    const [agentData, summaryData] = await Promise.all([
      call("fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_all_agent_statuses"),
      call("fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_team_board_summary"),
    ]);
    agents.value = agentData;
    summary.value = summaryData;
    lastRefreshed.value = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } finally {
    loading.value = false;
  }
}

const INTERVAL = 60;
const countdown = ref(INTERVAL);
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const countdownLabel = computed(() => {
  const m = Math.floor(countdown.value / 60);
  const s = countdown.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

function durationLabel(lastUpdated: string | null): string {
  if (!lastUpdated) return "—";
  const diffMins = Math.floor((now.value.getTime() - new Date(lastUpdated).getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const h = Math.floor(diffMins / 60); const m = diffMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ["#94a3b8", "#64748b", "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

onMounted(() => {
  load();
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) load();
  }, 1000);
  clockTimer = setInterval(() => { now.value = new Date(); }, 10000);

  socket.on("agent_status_changed", (data: any) => {
    if (!data?.user) return;
    const idx = agents.value.findIndex((a) => a.user === data.user);
    if (idx !== -1) {
      agents.value[idx] = { ...agents.value[idx], status: data.status, last_updated: data.last_updated };
    }
    // Refresh summary silently
    call("fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_team_board_summary")
      .then((s: TeamSummary) => { summary.value = s; });
  });
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
  if (clockTimer) clearInterval(clockTimer);
  socket.off("agent_status_changed");
});
</script>
