<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">Agent Performance</span>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <input
            v-model="fromDate"
            type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4"
          />
          <span class="text-ink-gray-4 text-sm">to</span>
          <input
            v-model="toDate"
            type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4"
          />
          <Button variant="solid" :loading="loading" @click="load">
            Apply
          </Button>
        </div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-40 text-ink-gray-4">
        Loading…
      </div>

      <template v-else-if="data">
        <!-- Summary cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1"
          >
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">
              {{ card.label }}
            </span>
            <span class="text-2xl font-semibold text-ink-gray-9">{{ card.value }}</span>
            <span v-if="card.sub" class="text-xs text-ink-gray-4">{{ card.sub }}</span>
          </div>
        </div>

        <!-- Per-agent table -->
        <div class="rounded-xl border overflow-hidden bg-surface-white">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-surface-gray-1">
                <th
                  v-for="col in columns"
                  :key="col.key"
                  class="px-4 py-3 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer select-none hover:text-ink-gray-8"
                  @click="sortBy(col.key)"
                >
                  <span class="flex items-center gap-1">
                    {{ col.label }}
                    <span v-if="sortKey === col.key" class="text-ink-gray-7">
                      {{ sortDir === 'asc' ? '↑' : '↓' }}
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(agent, i) in sortedAgents"
                :key="agent.agent"
                class="border-b last:border-0 hover:bg-surface-gray-1 transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                      :style="{ backgroundColor: avatarColor(agent.agent) }"
                    >
                      {{ initials(agent.agent_name) }}
                    </span>
                    <div class="flex flex-col">
                      <span class="font-medium text-ink-gray-8">{{ agent.agent_name }}</span>
                      <span class="text-xs text-ink-gray-4">{{ agent.agent }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="font-semibold text-ink-gray-8">{{ agent.tickets_resolved }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="text-ink-gray-6">{{ agent.tickets_created }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    v-if="agent.avg_first_response_sec != null"
                    :class="frtClass(agent.avg_first_response_sec)"
                    class="font-medium"
                  >
                    {{ formatDuration(agent.avg_first_response_sec) }}
                  </span>
                  <span v-else class="text-ink-gray-3">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    v-if="agent.avg_resolution_sec != null"
                    class="text-ink-gray-6"
                  >
                    {{ formatDuration(agent.avg_resolution_sec) }}
                  </span>
                  <span v-else class="text-ink-gray-3">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <div v-if="agent.avg_csat != null" class="flex items-center justify-center gap-1">
                    <span class="font-semibold" :class="csatClass(agent.avg_csat)">
                      {{ agent.avg_csat.toFixed(1) }}
                    </span>
                    <span class="text-xs text-ink-gray-4">/ 5</span>
                    <span class="text-xs text-ink-gray-3">({{ agent.csat_responses }})</span>
                  </div>
                  <span v-else class="text-ink-gray-3">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="!sortedAgents.length"
            class="flex flex-col items-center justify-center py-16 text-ink-gray-4 gap-2"
          >
            <FeatherIcon name="bar-chart-2" class="h-10 w-10" />
            <p class="text-sm font-medium">No data for this period</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { call } from "frappe-ui";
import { Button, FeatherIcon } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

// ── Date range (default: current month) ───────────────────────────────────
const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

const fromDate = ref(fmt(firstOfMonth));
const toDate   = ref(fmt(today));

// ── Data ───────────────────────────────────────────────────────────────────
interface AgentRow {
  agent: string;
  agent_name: string;
  tickets_resolved: number;
  tickets_created: number;
  avg_first_response_sec: number | null;
  avg_resolution_sec: number | null;
  avg_csat: number | null;
  csat_responses: number;
}

interface Summary {
  total_resolved: number;
  total_created: number;
  avg_first_response_sec: number | null;
  avg_resolution_sec: number | null;
  avg_csat: number | null;
}

interface PerformanceData {
  agents: AgentRow[];
  summary: Summary;
}

const data    = ref<PerformanceData | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.performance.get_agent_performance",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ── Summary cards ──────────────────────────────────────────────────────────
const summaryCards = computed(() => {
  const s = data.value?.summary;
  if (!s) return [];
  return [
    {
      label: "Tickets Resolved",
      value: s.total_resolved ?? 0,
      sub: `${s.total_created ?? 0} created`,
    },
    {
      label: "Avg First Response",
      value: s.avg_first_response_sec != null ? formatDuration(s.avg_first_response_sec) : "—",
      sub: "team average",
    },
    {
      label: "Avg Handle Time",
      value: s.avg_resolution_sec != null ? formatDuration(s.avg_resolution_sec) : "—",
      sub: "team average",
    },
    {
      label: "Avg CSAT",
      value: s.avg_csat != null ? `${s.avg_csat.toFixed(1)} / 5` : "—",
      sub: "customer satisfaction",
    },
  ];
});

// ── Table columns & sorting ────────────────────────────────────────────────
const columns = [
  { key: "agent_name",              label: "Agent"            },
  { key: "tickets_resolved",        label: "Resolved"         },
  { key: "tickets_created",         label: "Created"          },
  { key: "avg_first_response_sec",  label: "Avg First Reply"  },
  { key: "avg_resolution_sec",      label: "Avg Handle Time"  },
  { key: "avg_csat",                label: "CSAT"             },
];

const sortKey = ref<string>("tickets_resolved");
const sortDir = ref<"asc" | "desc">("desc");

function sortBy(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = "desc";
  }
}

const sortedAgents = computed(() => {
  const agents = [...(data.value?.agents ?? [])];
  return agents.sort((a, b) => {
    const av = (a as any)[sortKey.value] ?? -1;
    const bv = (b as any)[sortKey.value] ?? -1;
    return sortDir.value === "asc" ? av - bv : bv - av;
  });
});

// ── Formatters & helpers ───────────────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec < 60)    return `${sec}s`;
  if (sec < 3600)  return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function frtClass(sec: number): string {
  if (sec <= 3600)    return "text-green-600";   // ≤ 1h
  if (sec <= 14400)   return "text-amber-600";   // ≤ 4h
  return "text-red-600";
}

function csatClass(score: number): string {
  if (score >= 4)   return "text-green-600";
  if (score >= 3)   return "text-amber-600";
  return "text-red-600";
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
