<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideCalendarClock class="h-4 w-4 text-ink-gray-5" />
          <span class="text-base font-semibold text-ink-gray-9">Agent Availability</span>
        </div>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg border border-outline-gray-2 overflow-hidden text-xs">
            <button v-for="p in presets" :key="p.label"
              class="px-3 py-1.5 transition-colors"
              :class="activePreset === p.label ? 'text-white font-semibold' : 'bg-white text-ink-gray-6 hover:bg-surface-gray-1'"
              :style="activePreset === p.label ? 'background:#FF8643' : ''"
              @click="applyPreset(p)">
              {{ p.label }}
            </button>
          </div>
          <input v-model="fromDate" type="date"
            class="rounded-lg border border-outline-gray-2 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#FF8643]" />
          <span class="text-ink-gray-4 text-xs">→</span>
          <input v-model="toDate" type="date"
            class="rounded-lg border border-outline-gray-2 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#FF8643]" />
          <button
            v-if="rows.length"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-gray-2 bg-white text-ink-gray-7 text-sm font-medium hover:bg-surface-gray-1 transition-colors"
            @click="downloadCSV">
            <LucideDownload class="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style="background:#FF8643"
            :disabled="loading"
            @click="load">
            <LucideRefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
            Apply
          </button>
        </div>
      </template>
    </LayoutHeader>

    <div class="flex-1 min-h-0 overflow-auto px-6 py-5">
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style="border-color:#FF8643; border-top-color:transparent" />
        <p class="text-sm text-ink-gray-5">Loading availability data…</p>
      </div>

      <div v-else-if="!rows.length" class="flex flex-col items-center justify-center h-48 gap-3 text-ink-gray-4">
        <LucideCalendarClock class="h-12 w-12 opacity-40" />
        <p class="text-sm font-medium">No data for this period</p>
        <p class="text-xs text-ink-gray-3">Try a wider date range</p>
      </div>

      <div v-else class="rounded-xl overflow-hidden border border-outline-gray-2 shadow-sm bg-surface-white">
        <div class="flex items-center gap-2 px-4 py-2 bg-surface-gray-2 border-b border-outline-gray-2">
          <span class="text-xs font-semibold text-ink-gray-7 uppercase tracking-wide">Agent Availability</span>
          <span class="ml-auto text-xs text-ink-gray-4">{{ fromDate }} → {{ toDate }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="text-xs border-collapse w-full">
            <thead>
              <tr class="bg-surface-gray-1 border-b border-outline-gray-2">
                <th class="sticky left-0 z-20 bg-surface-gray-1 px-4 py-2.5 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide border-r border-outline-gray-2 min-w-[180px]"
                  style="box-shadow: 2px 0 4px rgba(0,0,0,0.05)">
                  Agent
                </th>
                <th v-for="s in STATUSES" :key="s.value"
                  class="px-4 py-2.5 text-center font-semibold text-ink-gray-5 uppercase tracking-wide whitespace-nowrap border-r border-outline-gray-2 min-w-[96px]">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="inline-block w-1.5 h-1.5 rounded-full" :style="`background:${s.color}`" />
                    {{ s.label }}
                  </span>
                </th>
                <th class="px-4 py-2.5 text-center font-semibold text-ink-gray-5 uppercase tracking-wide whitespace-nowrap border-r border-outline-gray-2 min-w-[80px] bg-surface-gray-2">
                  % Online
                </th>
                <th class="px-4 py-2.5 text-center font-semibold text-ink-gray-5 uppercase tracking-wide whitespace-nowrap min-w-[80px] bg-surface-gray-2">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Totals row -->
              <tr class="border-b border-outline-gray-2 bg-surface-gray-1">
                <td class="sticky left-0 z-10 bg-surface-gray-1 px-4 py-2 border-r border-outline-gray-2 font-semibold text-ink-gray-6 text-xs uppercase tracking-wide"
                  style="box-shadow: 2px 0 4px rgba(0,0,0,0.05)">
                  Team total
                </td>
                <td v-for="s in STATUSES" :key="s.value"
                  class="px-4 py-2 text-center border-r border-outline-gray-2 font-semibold text-ink-gray-7 tabular-nums">
                  {{ fmtSecs(teamStatusTotal(s.value)) }}
                </td>
                <td class="px-4 py-2 text-center font-semibold tabular-nums border-r border-outline-gray-2 bg-surface-gray-2"
                  :class="teamOnlinePct >= 70 ? 'text-green-700' : teamOnlinePct >= 40 ? 'text-amber-700' : 'text-red-600'">
                  {{ teamOnlinePct }}%
                </td>
                <td class="px-4 py-2 text-center font-semibold text-ink-gray-7 tabular-nums bg-surface-gray-2">
                  {{ fmtSecs(teamStatusTotal('Online') + teamStatusTotal('On Break') + teamStatusTotal('Lunch') + teamStatusTotal('In Training') + teamStatusTotal('Offline')) }}
                </td>
              </tr>
              <!-- Agent rows -->
              <tr v-for="row in sortedRows" :key="row.agent"
                class="border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1 transition-colors">
                <td class="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-outline-gray-2 whitespace-nowrap"
                  style="box-shadow: 2px 0 4px rgba(0,0,0,0.05)">
                  <div class="flex items-center gap-2">
                    <div class="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold flex-shrink-0"
                      :style="`background:${avatarColor(row.full_name)}`">
                      {{ initials(row.full_name) }}
                    </div>
                    <span class="font-medium text-ink-gray-8">{{ row.full_name }}</span>
                  </div>
                </td>
                <td v-for="s in STATUSES" :key="s.value"
                  class="px-4 py-2.5 text-center border-r border-outline-gray-2 tabular-nums">
                  <span :class="row.by_status[s.value] ? 'font-medium text-ink-gray-8' : 'text-ink-gray-3'">
                    {{ fmtSecs(row.by_status[s.value]) }}
                  </span>
                </td>
                <!-- % Online -->
                <td class="px-4 py-2.5 text-center tabular-nums font-semibold border-r border-outline-gray-2 bg-surface-gray-1"
                  :class="onlinePct(row) >= 70 ? 'text-green-700' : onlinePct(row) >= 40 ? 'text-amber-700' : 'text-red-600'">
                  {{ onlinePct(row) }}%
                </td>
                <!-- Total -->
                <td class="px-4 py-2.5 text-center font-semibold text-ink-gray-6 tabular-nums bg-surface-gray-1">
                  {{ fmtSecs(totalSecs(row)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Legend -->
      <div v-if="rows.length" class="flex items-center gap-4 mt-3 text-xs text-ink-gray-4">
        <span v-for="s in STATUSES" :key="s.value" class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full" :style="`background:${s.color}`" />
          {{ s.label }}
        </span>
        <span class="text-ink-gray-3 ml-2">sorted by % online ↑ (lowest first)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { call } from "frappe-ui";
import { computed, onMounted, ref } from "vue";
import LucideCalendarClock from "~icons/lucide/calendar-clock";
import LucideDownload from "~icons/lucide/download";
import LucideRefreshCw from "~icons/lucide/refresh-cw";

const STATUSES = [
  { value: "Online",      label: "Online",      color: "#22c55e" },
  { value: "On Break",    label: "On Break",    color: "#f59e0b" },
  { value: "Lunch",       label: "Lunch",       color: "#f97316" },
  { value: "In Training", label: "In Training", color: "#3b82f6" },
  { value: "Offline",     label: "Offline",     color: "#9ca3af" },
];

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
const today = new Date();
const week  = new Date(today); week.setDate(today.getDate() - 6);
const fromDate = ref(fmt(week));
const toDate   = ref(fmt(today));
const activePreset = ref("7 Days");

const presets = [
  { label: "Today",   days: 0 },
  { label: "7 Days",  days: 6 },
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

interface ReportRow {
  agent: string; user: string; full_name: string;
  by_status: Record<string, number>;
}

const rows    = ref<ReportRow[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    rows.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_agent_status_report",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function onlinePct(row: ReportRow): number {
  const total = totalSecs(row);
  if (!total) return 0;
  return Math.round(100 * (row.by_status["Online"] ?? 0) / total);
}

function teamStatusTotal(status: string): number {
  return rows.value.reduce((s, r) => s + (r.by_status[status] ?? 0), 0);
}

const teamOnlinePct = computed(() => {
  const allSecs = rows.value.reduce((s, r) => s + totalSecs(r), 0);
  if (!allSecs) return 0;
  return Math.round(100 * teamStatusTotal("Online") / allSecs);
});

// Sort by % online ascending (worst performers first) so issues are visible immediately
const sortedRows = computed(() =>
  [...rows.value].sort((a, b) => onlinePct(a) - onlinePct(b))
);

function totalSecs(row: ReportRow): number {
  return Object.values(row.by_status).reduce((s, v) => s + v, 0);
}

function fmtSecs(secs: number): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

function downloadCSV() {
  const headers = ["Agent", ...STATUSES.map((s) => s.label), "Total"];
  const csvRows = [headers.map((h) => `"${h}"`).join(",")];
  for (const row of sortedRows.value) {
    csvRows.push([
      row.full_name,
      ...STATUSES.map((s) => fmtSecs(row.by_status[s.value] ?? 0)),
      fmtSecs(totalSecs(row)),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-availability-${fromDate.value}-to-${toDate.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
