<template>
  <div class="flex flex-col w-full">
    <div class="sticky top-0 z-10 bg-white">
      <LayoutHeader>
        <template #left-header>
          <span class="text-lg font-medium text-gray-900">Agent Status</span>
        </template>
        <template #right-header>
          <Button variant="ghost" :loading="loadingAll" @click="refresh">
            <template #icon>
              <LucideRefreshCw class="h-4 w-4" />
            </template>
          </Button>
        </template>
      </LayoutHeader>

      <!-- Tabs -->
      <div class="flex border-b px-5 gap-4 text-sm font-medium">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="py-2.5 border-b-2 transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-ink-gray-9 text-ink-gray-9'
              : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7'
          "
          @click="activeTab = tab.key as 'live' | 'report'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Tab: Live Status -->
    <div v-if="activeTab === 'live'" class="p-5">
      <!-- Summary bar -->
      <div class="mb-5 flex flex-wrap gap-3">
        <div
          v-for="s in STATUS_OPTIONS"
          :key="s.value"
          class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
        >
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: s.color }" />
          {{ s.label }}:
          <span class="font-semibold">{{ countByStatus(s.value) }}</span>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loadingAll" class="flex justify-center items-center h-40">
        <Button :loading="true" size="2xl" variant="ghost" />
      </div>

      <!-- Agent grid -->
      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <div
          v-for="agent in agents"
          :key="agent.agent"
          class="flex flex-col items-center gap-2 rounded-xl border bg-surface-white p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <!-- Avatar -->
          <div class="relative">
            <Avatar
              :label="agent.full_name"
              :image="agent.user_image ?? undefined"
              size="xl"
            />
            <!-- Status dot -->
            <span
              class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white"
              :style="{ backgroundColor: STATUS_COLOR[agent.status] ?? '#9ca3af' }"
            />
          </div>

          <div class="text-center">
            <p class="text-sm font-medium text-ink-gray-9 truncate max-w-[120px]">
              {{ agent.full_name }}
            </p>
            <p class="text-xs text-ink-gray-5 mt-0.5">
              {{ agent.status }}
              <template v-if="agentDuration(agent.last_updated)">
                · {{ agentDuration(agent.last_updated) }}
              </template>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Availability Report -->
    <div v-if="activeTab === 'report'" class="p-5">
      <!-- Filters -->
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-ink-gray-6">From</label>
          <input
            v-model="reportFrom"
            type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-ink-gray-6">To</label>
          <input
            v-model="reportTo"
            type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4"
          />
        </div>
        <Button size="sm" @click="fetchReport">Run Report</Button>
      </div>

      <!-- Report loading -->
      <div v-if="loadingReport" class="flex justify-center items-center h-40">
        <Button :loading="true" size="2xl" variant="ghost" />
      </div>

      <!-- Report table -->
      <div v-else-if="reportData.length" class="overflow-x-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead class="bg-surface-gray-1 text-xs font-medium text-ink-gray-6 uppercase">
            <tr>
              <th class="px-4 py-3 text-left">Agent</th>
              <th v-for="s in reportStatuses" :key="s" class="px-4 py-3 text-right">
                {{ s }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-gray-1">
            <tr
              v-for="row in reportData"
              :key="row.agent"
              class="hover:bg-surface-gray-1"
            >
              <td class="px-4 py-3 font-medium text-ink-gray-9">{{ row.full_name }}</td>
              <td
                v-for="s in reportStatuses"
                :key="s"
                class="px-4 py-3 text-right text-ink-gray-7 tabular-nums"
              >
                {{ formatDuration(row.by_status[s] ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else-if="reportFetched"
        class="flex items-center justify-center h-40 text-sm text-ink-gray-5"
      >
        No data found for the selected range.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader } from "@/components";
import { STATUS_COLOR, STATUS_OPTIONS, useAgentStatusStore } from "@/stores/agentStatus";
import { Avatar, Button, call } from "frappe-ui";
import { onMounted, onUnmounted, ref } from "vue";
import LucideRefreshCw from "~icons/lucide/refresh-cw";

// -------------------------------------------------------------------------
// Live Status (Feature 1)
// -------------------------------------------------------------------------

interface AgentRow {
  agent: string;
  user: string;
  full_name: string;
  user_image: string | null;
  status: string;
  last_updated: string | null;
}

const agents = ref<AgentRow[]>([]);
const loadingAll = ref(false);
const nowTick = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval>;

const store = useAgentStatusStore();

async function fetchAgents() {
  loadingAll.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_all_agent_statuses"
    );
    agents.value = result ?? [];
  } finally {
    loadingAll.value = false;
  }
}

function refresh() {
  if (activeTab.value === "live") fetchAgents();
  else fetchReport();
}

function countByStatus(status: string) {
  return agents.value.filter((a) => a.status === status).length;
}

function agentDuration(lastUpdated: string | null): string | null {
  if (!lastUpdated) return null;
  const diffMs = nowTick.value - new Date(lastUpdated).getTime();
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Real-time patch when any agent changes status
function onAgentStatusChanged(data: AgentRow) {
  const idx = agents.value.findIndex((a) => a.agent === data.agent);
  if (idx !== -1) {
    agents.value[idx] = { ...agents.value[idx], ...data };
  } else {
    agents.value.push(data);
  }
}

// -------------------------------------------------------------------------
// Tabs
// -------------------------------------------------------------------------

const tabs = [
  { key: "live", label: "Live Status" },
  { key: "report", label: "Availability Report" },
];
const activeTab = ref<"live" | "report">("live");

// -------------------------------------------------------------------------
// Availability Report (Feature 2)
// -------------------------------------------------------------------------

const reportStatuses = ["Online", "On Break", "Lunch", "In Training", "Offline"];

interface ReportRow {
  agent: string;
  full_name: string;
  by_status: Record<string, number>;
}

const reportData = ref<ReportRow[]>([]);
const loadingReport = ref(false);
const reportFetched = ref(false);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const reportFrom = ref(todayStr());
const reportTo = ref(todayStr());

async function fetchReport() {
  loadingReport.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_agent_status_report",
      { from_date: reportFrom.value, to_date: reportTo.value }
    );
    reportData.value = result ?? [];
    reportFetched.value = true;
  } finally {
    loadingReport.value = false;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

// -------------------------------------------------------------------------
// Lifecycle
// -------------------------------------------------------------------------

onMounted(() => {
  fetchAgents();
  store.subscribeToTeamUpdates(onAgentStatusChanged);
  clockTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 30_000);
});

onUnmounted(() => {
  store.unsubscribeFromTeamUpdates();
  clearInterval(clockTimer);
});
</script>
