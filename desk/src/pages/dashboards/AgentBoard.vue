<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideUsers class="h-5 w-5" style="color:#FF8643" />
          <span class="text-lg font-semibold text-ink-gray-9">Live Agent Board</span>
          <span class="ml-1 text-xs text-ink-gray-4">
            — updated <span class="tabular-nums">{{ lastRefreshed }}</span>
          </span>
        </div>
      </template>
      <template #right-header>
        <div class="flex items-center gap-3">
          <!-- Status filter pills -->
          <div class="flex rounded-lg border border-outline-gray-2 overflow-hidden text-xs">
            <button
              v-for="f in statusFilters"
              :key="f.value"
              class="px-3 py-1.5 transition-colors"
              :class="activeFilter === f.value ? 'text-white font-semibold' : 'bg-white text-ink-gray-6 hover:bg-surface-gray-1'"
              :style="activeFilter === f.value ? `background:${f.color}` : ''"
              @click="activeFilter = f.value">
              {{ f.label }}
            </button>
          </div>
          <span class="text-xs text-ink-gray-3 tabular-nums">
            <LucideTimer class="inline h-3 w-3 mr-0.5" />{{ countdownLabel }}
          </span>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style="background:#FF8643"
            @click="load">
            <LucideRefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
            Refresh
          </button>
        </div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-auto px-6 py-5">
      <!-- Summary strip -->
      <div v-if="agents.length" class="flex items-center gap-6 mb-5">
        <div v-for="s in statusSummary" :key="s.status" class="flex items-center gap-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full" :style="`background:${s.color}`" />
          <span class="text-sm text-ink-gray-6">
            <strong class="text-ink-gray-9">{{ s.count }}</strong> {{ s.status }}
          </span>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style="border-color:#FF8643; border-top-color:transparent" />
        <p class="text-sm text-ink-gray-5">Loading agent statuses…</p>
      </div>

      <div v-else-if="!agents.length" class="flex flex-col items-center justify-center h-48 gap-3 text-ink-gray-4">
        <LucideUsers class="h-12 w-12 opacity-40" />
        <p class="text-sm font-medium">No agents found</p>
      </div>

      <!-- Agent cards -->
      <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
        <div
          v-for="agent in filteredAgents"
          :key="agent.user"
          class="bg-white rounded-xl border border-outline-gray-2 p-4 shadow-sm flex flex-col items-center gap-3 transition-all hover:shadow-md">
          <!-- Avatar -->
          <div
            class="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 relative"
            :style="`background:${avatarColor(agent.full_name)}`">
            {{ initials(agent.full_name) }}
            <!-- Status dot -->
            <span
              class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
              :style="`background:${statusColor(agent.status)}`" />
          </div>
          <!-- Name -->
          <div class="text-center">
            <p class="font-semibold text-ink-gray-9 text-sm leading-tight">{{ agent.full_name }}</p>
            <p class="text-xs text-ink-gray-4 mt-0.5 truncate max-w-[160px]">{{ agent.user }}</p>
          </div>
          <!-- Status badge -->
          <span
            class="px-2.5 py-1 rounded-full text-xs font-semibold"
            :style="statusBadgeStyle(agent.status)">
            {{ agent.status }}
          </span>
          <!-- Duration -->
          <p class="text-xs text-ink-gray-4">
            {{ durationLabel(agent.last_updated) }}
          </p>
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
}

const agents = ref<AgentStatus[]>([]);
const loading = ref(false);
const now = ref(new Date());
const lastRefreshed = ref("—");
const activeFilter = ref("All");

const statusFilters = [
  { label: "All",         value: "All",         color: "#6b7280" },
  { label: "Online",      value: "Online",      color: "#22c55e" },
  { label: "Away",        value: "Away",        color: "#f59e0b" },
  { label: "Offline",     value: "Offline",     color: "#9ca3af" },
];

const STATUS_COLORS: Record<string, string> = {
  "Online":      "#22c55e",
  "On Break":    "#f59e0b",
  "Lunch":       "#f97316",
  "In Training": "#3b82f6",
  "Offline":     "#9ca3af",
};

function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? "#9ca3af";
}

function statusBadgeStyle(s: string): Record<string, string> {
  const color = STATUS_COLORS[s] ?? "#9ca3af";
  return {
    background: color + "22",
    color,
    border: `1px solid ${color}44`,
  };
}

function statusGroup(s: string): "Online" | "Away" | "Offline" {
  if (s === "Online") return "Online";
  if (s === "Offline") return "Offline";
  return "Away";
}

const filteredAgents = computed(() => {
  const sorted = [...agents.value].sort((a, b) => {
    const order = ["Online", "Away", "Offline"];
    return order.indexOf(statusGroup(a.status)) - order.indexOf(statusGroup(b.status))
      || a.full_name.localeCompare(b.full_name);
  });
  if (activeFilter.value === "All") return sorted;
  return sorted.filter((a) => statusGroup(a.status) === activeFilter.value);
});

const statusSummary = computed(() => {
  const groups = { Online: 0, Away: 0, Offline: 0 };
  for (const a of agents.value) groups[statusGroup(a.status)]++;
  return [
    { status: "Online", count: groups.Online, color: "#22c55e" },
    { status: "Away",   count: groups.Away,   color: "#f59e0b" },
    { status: "Offline",count: groups.Offline,color: "#9ca3af" },
  ];
});

async function load() {
  loading.value = true;
  countdown.value = INTERVAL;
  try {
    agents.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_all_agent_statuses"
    );
    lastRefreshed.value = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } finally {
    loading.value = false;
  }
}

// Auto-refresh every 5 minutes (shorter interval for a live board)
const INTERVAL = 300;
const countdown = ref(INTERVAL);
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const countdownLabel = computed(() => {
  const m = Math.floor(countdown.value / 60);
  const s = countdown.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

function durationLabel(lastUpdated: string | null): string {
  if (!lastUpdated) return "Status unknown";
  const diffMs = now.value.getTime() - new Date(lastUpdated).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `for ${diffMins}m`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `for ${hrs}h${mins > 0 ? ` ${mins}m` : ""}`;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function avatarColor(name: string): string {
  const colors = ["#FF8643", "#99E8D3", "#6366F1", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"];
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
  clockTimer = setInterval(() => { now.value = new Date(); }, 5000);

  // Real-time status updates via socket
  socket.on("agent_status_changed", (data: any) => {
    if (!data?.user) return;
    const idx = agents.value.findIndex((a) => a.user === data.user);
    if (idx !== -1) {
      agents.value[idx] = { ...agents.value[idx], status: data.status, last_updated: data.last_updated };
    }
  });
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
  if (clockTimer) clearInterval(clockTimer);
  socket.off("agent_status_changed");
});
</script>
