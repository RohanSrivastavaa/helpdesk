<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">First Contact Resolution</span>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <input v-model="fromDate" type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4" />
          <span class="text-ink-gray-4 text-sm">to</span>
          <input v-model="toDate" type="date"
            class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-outline-gray-4" />
          <Button variant="solid" :loading="loading" @click="load">Apply</Button>
        </div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

      <div v-if="loading && !data" class="flex items-center justify-center h-40 text-ink-gray-4">
        Loading…
      </div>

      <template v-else-if="data">

        <!-- ── Summary cards ──────────────────────────────────────── -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <!-- FCR Rate — big gauge card -->
          <div class="rounded-xl border bg-surface-white p-5 flex flex-col items-center justify-center gap-2 col-span-2 sm:col-span-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">FCR Rate</span>
            <div class="relative flex items-center justify-center w-24 h-24">
              <!-- SVG gauge ring -->
              <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  :stroke="gaugeColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="100"
                  :stroke-dashoffset="100 - (data.summary.fcr_rate ?? 0)"
                />
              </svg>
              <span class="text-xl font-bold z-10" :class="gaugeTextColor">
                {{ data.summary.fcr_rate != null ? `${data.summary.fcr_rate}%` : '—' }}
              </span>
            </div>
            <span class="text-xs text-ink-gray-4">target ≥ 70%</span>
          </div>

          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Tickets Resolved</span>
            <span class="text-3xl font-bold text-ink-gray-9">{{ data.summary.total_resolved }}</span>
            <span class="text-xs text-ink-gray-4">in period</span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">FCR Tickets</span>
            <span class="text-3xl font-bold text-green-600">{{ data.summary.fcr_count }}</span>
            <span class="text-xs text-ink-gray-4">resolved first contact</span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Non-FCR</span>
            <span class="text-3xl font-bold text-red-500">
              {{ data.summary.total_resolved - data.summary.fcr_count }}
            </span>
            <span class="text-xs text-ink-gray-4">needed follow-up</span>
          </div>
        </div>

        <!-- ── Daily trend ─────────────────────────────────────────── -->
        <div v-if="data.daily.length" class="rounded-xl border bg-surface-white p-5">
          <h3 class="text-sm font-semibold text-ink-gray-7 mb-4">Daily FCR Trend</h3>
          <div class="flex items-end gap-1.5 h-32 overflow-x-auto">
            <div
              v-for="day in data.daily"
              :key="day.date"
              class="flex flex-col items-center gap-1 flex-shrink-0"
              :style="{ minWidth: '36px' }"
            >
              <!-- Stacked bar: FCR (green) + Non-FCR (red) -->
              <div
                class="relative w-7 flex flex-col-reverse rounded overflow-hidden"
                :style="{ height: `${barHeight(day.total_resolved)}px` }"
                :title="`${day.date}: ${day.fcr_count}/${day.total_resolved} FCR (${day.fcr_rate ?? 0}%)`"
              >
                <div
                  class="bg-green-400 w-full transition-all"
                  :style="{ height: `${fcrBarPct(day)}%` }"
                />
                <div
                  class="bg-red-400 w-full transition-all"
                  :style="{ height: `${100 - fcrBarPct(day)}%` }"
                />
              </div>
              <span class="text-xs text-ink-gray-4 whitespace-nowrap">
                {{ fmtDay(day.date) }}
              </span>
            </div>
          </div>
          <!-- Legend -->
          <div class="flex items-center gap-4 mt-3 text-xs text-ink-gray-5">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-400 inline-block" /> FCR</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-400 inline-block" /> Non-FCR</span>
          </div>
        </div>

        <!-- ── Per-agent table ─────────────────────────────────────── -->
        <div class="rounded-xl border overflow-hidden bg-surface-white">
          <div class="px-4 py-3 border-b bg-surface-gray-1">
            <h3 class="text-sm font-semibold text-ink-gray-7">FCR by Agent</h3>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-surface-gray-1">
                <th
                  v-for="col in columns"
                  :key="col.key"
                  class="px-4 py-3 text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer select-none hover:text-ink-gray-8"
                  :class="col.center ? 'text-center' : 'text-left'"
                  @click="sortBy(col.key)"
                >
                  {{ col.label }}
                  <span v-if="sortKey === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="agent in sortedAgents"
                :key="agent.agent"
                class="border-b last:border-0 hover:bg-surface-gray-1 transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
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
                <td class="px-4 py-3 text-center font-semibold text-ink-gray-7">
                  {{ agent.total_resolved }}
                </td>
                <td class="px-4 py-3 text-center text-green-600 font-semibold">
                  {{ agent.fcr_count }}
                </td>
                <td class="px-4 py-3 text-center">
                  <div v-if="agent.fcr_rate != null" class="flex items-center justify-center gap-2">
                    <div class="w-20 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="fcrBarColor(agent.fcr_rate)"
                        :style="{ width: `${agent.fcr_rate}%` }"
                      />
                    </div>
                    <span class="font-semibold text-sm w-12" :class="fcrTextColor(agent.fcr_rate)">
                      {{ agent.fcr_rate }}%
                    </span>
                  </div>
                  <span v-else class="text-ink-gray-3">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="!data.by_agent.length"
            class="flex flex-col items-center justify-center py-12 text-ink-gray-4 gap-2"
          >
            <FeatherIcon name="inbox" class="h-8 w-8" />
            <p class="text-sm">No resolved tickets in this period</p>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call, FeatherIcon } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

// ── Date range ─────────────────────────────────────────────────────────────
const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const fromDate = ref(fmt(firstOfMonth));
const toDate   = ref(fmt(today));

// ── Types ──────────────────────────────────────────────────────────────────
interface AgentRow {
  agent: string;
  agent_name: string;
  total_resolved: number;
  fcr_count: number;
  fcr_rate: number | null;
}
interface DayRow {
  date: string;
  total_resolved: number;
  fcr_count: number;
  fcr_rate: number | null;
}
interface FCRData {
  summary: {
    total_resolved: number;
    fcr_count: number;
    fcr_rate: number | null;
    from_date: string;
    to_date: string;
  };
  daily: DayRow[];
  by_agent: AgentRow[];
}

// ── State ──────────────────────────────────────────────────────────────────
const data    = ref<FCRData | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.fcr.get_fcr_report",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ── Gauge ──────────────────────────────────────────────────────────────────
const gaugeColor = computed(() => {
  const r = data.value?.summary.fcr_rate;
  if (r == null) return "#d1d5db";
  if (r >= 70)  return "#22c55e";
  if (r >= 50)  return "#f59e0b";
  return "#ef4444";
});

const gaugeTextColor = computed(() => {
  const r = data.value?.summary.fcr_rate;
  if (r == null) return "text-ink-gray-4";
  if (r >= 70)  return "text-green-600";
  if (r >= 50)  return "text-amber-600";
  return "text-red-600";
});

// ── Daily bar chart ────────────────────────────────────────────────────────
const maxDayTotal = computed(() =>
  Math.max(1, ...(data.value?.daily.map(d => d.total_resolved) ?? [1]))
);

function barHeight(total: number): number {
  return Math.max(4, Math.round((total / maxDayTotal.value) * 100));
}

function fcrBarPct(day: DayRow): number {
  if (!day.total_resolved) return 0;
  return Math.round((day.fcr_count / day.total_resolved) * 100);
}

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Agent table sorting ────────────────────────────────────────────────────
const columns = [
  { key: "agent_name",     label: "Agent",    center: false },
  { key: "total_resolved", label: "Resolved", center: true  },
  { key: "fcr_count",      label: "FCR",      center: true  },
  { key: "fcr_rate",       label: "FCR Rate", center: true  },
];

const sortKey = ref("total_resolved");
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
  const agents = [...(data.value?.by_agent ?? [])];
  return agents.sort((a, b) => {
    const av = (a as any)[sortKey.value] ?? -1;
    const bv = (b as any)[sortKey.value] ?? -1;
    return sortDir.value === "asc" ? av - bv : bv - av;
  });
});

// ── Styles ─────────────────────────────────────────────────────────────────
function fcrBarColor(rate: number): string {
  if (rate >= 70) return "bg-green-500";
  if (rate >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function fcrTextColor(rate: number): string {
  if (rate >= 70) return "text-green-600";
  if (rate >= 50) return "text-amber-600";
  return "text-red-600";
}

// ── Helpers ────────────────────────────────────────────────────────────────
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
