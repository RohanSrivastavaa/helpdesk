<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideClock class="h-4 w-4 text-ink-gray-5" />
          <span class="text-base font-semibold text-ink-gray-9">Agent Resolution Time</span>
        </div>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <div class="flex rounded-md border border-outline-gray-2 overflow-hidden text-xs">
            <button v-for="p in presets" :key="p.label"
              class="px-3 py-1.5 transition-colors"
              :class="activePreset === p.label
                ? 'bg-ink-gray-8 text-white font-medium'
                : 'bg-white text-ink-gray-6 hover:bg-surface-gray-1'"
              @click="applyPreset(p)">
              {{ p.label }}
            </button>
          </div>
          <input v-model="fromDate" type="date"
            class="rounded-md border border-outline-gray-2 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-ink-gray-4" />
          <span class="text-ink-gray-3 text-xs">→</span>
          <input v-model="toDate" type="date"
            class="rounded-md border border-outline-gray-2 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-ink-gray-4" />
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-outline-gray-2 bg-white text-ink-gray-7 text-xs font-medium hover:bg-surface-gray-1 transition-colors"
            :disabled="loading" @click="load">
            <LucideRefreshCw class="h-3 w-3" :class="{ 'animate-spin': loading }" />
            Apply
          </button>
          <button v-if="agents.length"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-outline-gray-2 bg-white text-ink-gray-7 text-xs font-medium hover:bg-surface-gray-1 transition-colors"
            @click="downloadCSV">
            <LucideDownload class="h-3 w-3" />
            CSV
          </button>
          <span class="text-xs text-ink-gray-3 tabular-nums">
            <LucideTimer class="inline h-3 w-3 mr-0.5" />{{ countdownLabel }}
          </span>
        </div>
      </template>
    </LayoutHeader>

    <!-- Summary strip -->
    <div v-if="summary" class="flex items-center gap-6 px-6 py-3 border-b border-outline-gray-2 bg-white text-sm">
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9 tabular-nums">{{ summary.total_resolved }}</span>
        <span class="text-ink-gray-5">resolved</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9 tabular-nums">{{ fmtSec(summary.avg_resolution_sec) }}</span>
        <span class="text-ink-gray-5">avg resolution</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9 tabular-nums">{{ fmtSec(summary.avg_first_response_sec) }}</span>
        <span class="text-ink-gray-5">avg first response</span>
      </div>
      <template v-if="summary.avg_csat">
        <div class="w-px h-4 bg-outline-gray-2" />
        <div class="flex items-center gap-1.5">
          <span class="font-semibold text-ink-gray-9 tabular-nums">{{ summary.avg_csat.toFixed(2) }} ★</span>
          <span class="text-ink-gray-5">avg CSAT</span>
        </div>
      </template>
    </div>

    <div class="flex-1 min-h-0 px-6 py-5 overflow-auto">
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin border-ink-gray-4" />
        <p class="text-sm text-ink-gray-5">Loading…</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!agents.length" class="flex flex-col items-center justify-center h-48 gap-2 text-ink-gray-4">
        <LucideClock class="h-10 w-10 opacity-30" />
        <p class="text-sm">No data for this period</p>
      </div>

      <!-- Table -->
      <div v-else class="rounded-lg border border-outline-gray-2 overflow-hidden bg-white">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-surface-gray-1 border-b border-outline-gray-2">
              <th class="px-4 py-3 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide min-w-[180px]">Agent</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer hover:text-ink-gray-8 select-none"
                @click="sort('tickets_resolved')">
                Resolved <SortIcon field="tickets_resolved" />
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer hover:text-ink-gray-8 select-none"
                @click="sort('avg_resolution_sec')">
                Avg Resolution <SortIcon field="avg_resolution_sec" />
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer hover:text-ink-gray-8 select-none"
                @click="sort('avg_first_response_sec')">
                Avg First Response <SortIcon field="avg_first_response_sec" />
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide cursor-pointer hover:text-ink-gray-8 select-none"
                @click="sort('avg_csat')">
                CSAT <SortIcon field="avg_csat" />
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">Assigned</th>
            </tr>
          </thead>
          <tbody>
            <!-- Team total row -->
            <tr class="bg-surface-gray-1 border-b border-outline-gray-2">
              <td class="px-4 py-2.5 text-xs font-semibold text-ink-gray-6 uppercase tracking-wide">Team Total</td>
              <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-8 tabular-nums">{{ summary?.total_resolved ?? '—' }}</td>
              <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-8 tabular-nums">{{ fmtSec(summary?.avg_resolution_sec) }}</td>
              <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-8 tabular-nums">{{ fmtSec(summary?.avg_first_response_sec) }}</td>
              <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-8 tabular-nums">{{ summary?.avg_csat ? summary.avg_csat.toFixed(2) + ' ★' : '—' }}</td>
              <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-8 tabular-nums">{{ summary?.total_created ?? '—' }}</td>
            </tr>
            <!-- Agent rows -->
            <tr v-for="a in sortedAgents" :key="a.agent"
              class="border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1 transition-colors">
              <td class="px-4 py-2.5">
                <div class="flex items-center gap-2">
                  <div class="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold flex-shrink-0"
                    :style="{ background: avatarColor(a.agent_name) }">
                    {{ initials(a.agent_name) }}
                  </div>
                  <span class="font-medium text-ink-gray-8">{{ a.agent_name }}</span>
                </div>
              </td>
              <td class="px-4 py-2.5 text-center font-medium text-ink-gray-8 tabular-nums">{{ a.tickets_resolved }}</td>
              <td class="px-4 py-2.5 text-center font-semibold tabular-nums" :style="{ color: resolutionColor(a.avg_resolution_sec) }">
                {{ fmtSec(a.avg_resolution_sec) }}
              </td>
              <td class="px-4 py-2.5 text-center text-ink-gray-7 tabular-nums">{{ fmtSec(a.avg_first_response_sec) }}</td>
              <td class="px-4 py-2.5 text-center tabular-nums" :class="csatClass(a.avg_csat)">
                {{ a.avg_csat ? a.avg_csat.toFixed(2) + ' ★' : '—' }}
              </td>
              <td class="px-4 py-2.5 text-center text-ink-gray-5 tabular-nums">{{ a.tickets_created }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div v-if="agents.length" class="flex items-center gap-5 text-xs text-ink-gray-4 mt-3">
        <span class="flex items-center gap-1.5"><span class="font-semibold text-green-700">■</span> ≤ 15 min</span>
        <span class="flex items-center gap-1.5"><span class="font-semibold text-amber-600">■</span> 15–30 min</span>
        <span class="flex items-center gap-1.5"><span class="font-semibold text-red-600">■</span> &gt; 30 min</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { call } from "frappe-ui";
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import LucideClock from "~icons/lucide/clock";
import LucideDownload from "~icons/lucide/download";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideTimer from "~icons/lucide/timer";
import LucideChevronUp from "~icons/lucide/chevron-up";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideChevronsUpDown from "~icons/lucide/chevrons-up-down";

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
const today = new Date();
const week = new Date(today); week.setDate(today.getDate() - 6);
const fromDate = ref(fmt(week));
const toDate = ref(fmt(today));
const activePreset = ref("7 Days");

const presets = [
  { label: "Today", days: 0 },
  { label: "7 Days", days: 6 },
  { label: "30 Days", days: 29 },
];

function applyPreset(p: { label: string; days: number }) {
  const t = new Date();
  const f = new Date(t); f.setDate(t.getDate() - p.days);
  fromDate.value = fmt(f);
  toDate.value = fmt(t);
  activePreset.value = p.label;
  load();
}

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

const agents = ref<AgentRow[]>([]);
const summary = ref<Summary | null>(null);
const loading = ref(false);

const sortField = ref<keyof AgentRow>("tickets_resolved");
const sortDir = ref<"asc" | "desc">("desc");

function sort(field: keyof AgentRow) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortField.value = field;
    sortDir.value = "desc";
  }
}

const sortedAgents = computed(() =>
  [...agents.value].sort((a, b) => {
    const av = (a[sortField.value] ?? -Infinity) as number;
    const bv = (b[sortField.value] ?? -Infinity) as number;
    return sortDir.value === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  })
);

const SortIcon = defineComponent({
  props: { field: { type: String, required: true } },
  setup(props) {
    return () => {
      if (sortField.value !== props.field)
        return h(LucideChevronsUpDown, { class: "inline h-3 w-3 ml-0.5 text-ink-gray-3" });
      return sortDir.value === "asc"
        ? h(LucideChevronUp, { class: "inline h-3 w-3 ml-0.5 text-ink-gray-7" })
        : h(LucideChevronDown, { class: "inline h-3 w-3 ml-0.5 text-ink-gray-7" });
    };
  },
});

const INTERVAL = 600;
const countdown = ref(INTERVAL);
let countdownTimer: ReturnType<typeof setInterval> | null = null;
const countdownLabel = computed(() => {
  const m = Math.floor(countdown.value / 60);
  const s = countdown.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

async function load() {
  countdown.value = INTERVAL;
  loading.value = true;
  try {
    const data = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.performance.get_agent_performance",
      { from_date: fromDate.value, to_date: toDate.value },
    );
    agents.value = data.agents ?? [];
    summary.value = data.summary ?? null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) load();
  }, 1000);
});
onUnmounted(() => { if (countdownTimer) clearInterval(countdownTimer); });

function fmtSec(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function resolutionColor(sec: number | null): string {
  if (sec == null) return "#9ca3af";
  const mins = sec / 60;
  if (mins <= 15) return "#15803d";
  if (mins <= 30) return "#d97706";
  return "#dc2626";
}

function csatClass(csat: number | null): string {
  if (csat == null) return "text-ink-gray-4";
  if (csat >= 4.5) return "text-green-700 font-medium";
  if (csat >= 3.5) return "text-amber-700 font-medium";
  return "text-red-600 font-medium";
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

function downloadCSV() {
  const headers = ["Agent", "Tickets Resolved", "Avg Resolution", "Avg Resolution (mins)", "Avg First Response", "Avg CSAT", "CSAT Responses", "Tickets Assigned"];
  const csvRows = [headers.map((h) => `"${h}"`).join(",")];
  for (const a of sortedAgents.value) {
    csvRows.push([
      a.agent_name,
      a.tickets_resolved,
      fmtSec(a.avg_resolution_sec),
      a.avg_resolution_sec ? (a.avg_resolution_sec / 60).toFixed(1) : "",
      fmtSec(a.avg_first_response_sec),
      a.avg_csat ?? "",
      a.csat_responses,
      a.tickets_created,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-resolution-time-${fromDate.value}-to-${toDate.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
