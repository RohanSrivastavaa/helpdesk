<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucidePieChart class="h-5 w-5" style="color:#FF8643" />
          <span class="text-lg font-semibold text-ink-gray-9">Reason Breakdown</span>
        </div>
      </template>
      <template #right-header>
        <div class="flex items-center gap-2">
          <!-- Quick presets -->
          <div class="flex rounded-lg border border-outline-gray-2 overflow-hidden text-xs">
            <button v-for="p in presets" :key="p.label"
              class="px-3 py-1.5 transition-colors"
              :class="activePreset === p.label
                ? 'text-white font-semibold'
                : 'bg-white text-ink-gray-6 hover:bg-surface-gray-1'"
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
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style="background:#FF8643"
            :disabled="loading"
            @click="load">
            <LucideRefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
            Apply
          </button>
          <button
            v-if="rows.length"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-gray-2 bg-white text-ink-gray-7 text-sm font-medium hover:bg-surface-gray-1 transition-colors"
            @click="downloadCSV">
            <LucideDownload class="h-3.5 w-3.5" />
            CSV
          </button>
          <span class="text-xs text-ink-gray-3 tabular-nums" title="Auto-refresh countdown">
            <LucideTimer class="inline h-3 w-3 mr-0.5 text-ink-gray-3" />{{ countdownLabel }}
          </span>
        </div>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-auto px-6 py-5">
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color:#FF8643; border-top-color:transparent" />
        <p class="text-sm text-ink-gray-5">Loading data…</p>
      </div>

      <div v-else-if="!rows.length" class="flex flex-col items-center justify-center h-48 gap-3 text-ink-gray-4">
        <LucideBarChart2 class="h-12 w-12 opacity-40" />
        <p class="text-sm font-medium">No data for this period</p>
        <p class="text-xs text-ink-gray-3">Try a wider date range</p>
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-outline-gray-2 shadow-sm bg-surface-white">
        <table class="text-sm border-collapse" style="min-width: max-content">
          <thead>
            <tr class="border-b border-outline-gray-2">
              <th class="sticky left-0 z-20 bg-surface-gray-1 px-4 py-3 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide border-r border-outline-gray-2 min-w-[160px]"
                style="box-shadow: 2px 0 4px rgba(0,0,0,0.06)">
                Reason
              </th>
              <th class="sticky z-20 bg-surface-gray-1 px-4 py-3 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide border-r border-outline-gray-2 min-w-[160px]"
                :style="{ left: '160px', boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }">
                Sub-reason
              </th>
              <th v-for="d in dates" :key="d"
                class="px-3 py-3 text-center text-xs font-semibold text-ink-gray-5 uppercase tracking-wide whitespace-nowrap border-r border-outline-gray-2 last:border-0 min-w-[76px]">
                {{ fmtDateCol(d) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Totals row -->
            <tr class="border-b border-outline-gray-2">
              <td class="sticky left-0 z-10 bg-surface-gray-1 px-4 py-2.5 border-r border-outline-gray-2 text-xs font-bold text-ink-gray-8 uppercase tracking-wide"
                style="box-shadow: 2px 0 4px rgba(0,0,0,0.06)">
                TOTAL
              </td>
              <td class="sticky z-10 bg-surface-gray-1 px-4 py-2.5 border-r border-outline-gray-2 text-ink-gray-4"
                :style="{ left: '160px', boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }">—</td>
              <td v-for="d in dates" :key="d"
                class="px-3 py-2.5 text-center border-r border-outline-gray-2 last:border-0 font-bold text-sm"
                :style="cellStyle(dateTotal(d))">
                {{ dateTotal(d) || '—' }}
              </td>
            </tr>

            <!-- Data rows grouped by reason -->
            <template v-for="group in groupedRows" :key="group.reason">
              <tr v-for="(sub, si) in group.subs" :key="sub.subreason"
                class="border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1 transition-colors">
                <td class="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-outline-gray-2 font-medium text-ink-gray-8 text-sm"
                  :class="si === 0 ? 'border-t-2' : ''"
                  :style="{ borderTopColor: si === 0 ? '#e5e7eb' : undefined, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }">
                  <span v-if="si === 0" class="flex items-center gap-1.5">
                    <span class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:#FF8643" />
                    {{ group.reason }}
                  </span>
                </td>
                <td class="sticky z-10 bg-white px-4 py-2.5 border-r border-outline-gray-2 text-ink-gray-6 text-sm"
                  :class="si === 0 ? 'border-t-2' : ''"
                  :style="{ left: '160px', borderTopColor: si === 0 ? '#e5e7eb' : undefined, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }">
                  {{ sub.subreason }}
                </td>
                <td v-for="d in dates" :key="d"
                  class="px-3 py-2.5 text-center border-r border-outline-gray-2 last:border-0 text-sm"
                  :class="si === 0 ? 'border-t-2' : ''"
                  :style="{ ...cellStyle(lookup(group.reason, sub.subreason, d)), borderTopColor: si === 0 ? '#e5e7eb' : undefined }">
                  {{ lookup(group.reason, sub.subreason, d) || '—' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div v-if="rows.length" class="mt-3 flex items-center gap-4 text-xs text-ink-gray-5">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded" style="background:#FF8643" />
          &gt; 200 tickets
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded" style="background:#FFE6CF" />
          50–200 tickets
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded border border-outline-gray-2" style="background:#fff" />
          &lt; 50 tickets
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { call } from "frappe-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";
import LucideBarChart2 from "~icons/lucide/bar-chart-2";
import LucideDownload from "~icons/lucide/download";
import LucidePieChart from "~icons/lucide/pie-chart";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideTimer from "~icons/lucide/timer";

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

interface Row { reason: string; subreason: string; date: string; count: number; }
const rows    = ref<Row[]>([]);
const loading = ref(false);

// Auto-refresh countdown
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
    rows.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.dashboards.get_reason_breakdown",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}

function downloadCSV() {
  const headers = ["Reason", "Sub-reason", "Date", "Count"];
  const csvRows = [headers.map((h) => `"${h}"`).join(",")];
  for (const r of rows.value) {
    csvRows.push([r.reason, r.subreason, r.date, r.count]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reason-breakdown-${fromDate.value}-to-${toDate.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  load();
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) load();
  }, 1000);
});
onUnmounted(() => { if (countdownTimer) clearInterval(countdownTimer); });

const dates = computed<string[]>(() => {
  const s = new Set(rows.value.map((r) => r.date));
  return [...s].sort((a, b) => (a < b ? 1 : -1));
});

const matrix = computed(() => {
  const m: Record<string, Record<string, Record<string, number>>> = {};
  for (const r of rows.value) {
    if (!m[r.reason]) m[r.reason] = {};
    if (!m[r.reason][r.subreason]) m[r.reason][r.subreason] = {};
    m[r.reason][r.subreason][r.date] = r.count;
  }
  return m;
});

function lookup(reason: string, subreason: string, date: string): number {
  return matrix.value[reason]?.[subreason]?.[date] ?? 0;
}

function dateTotal(date: string): number {
  return rows.value.filter((r) => r.date === date).reduce((s, r) => s + r.count, 0);
}

interface GroupRow { reason: string; subs: { subreason: string }[] }
const groupedRows = computed<GroupRow[]>(() => {
  const groups: Record<string, Set<string>> = {};
  for (const r of rows.value) {
    if (!groups[r.reason]) groups[r.reason] = new Set();
    groups[r.reason].add(r.subreason);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, subs]) => ({
      reason,
      subs: [...subs].sort().map((s) => ({ subreason: s })),
    }));
});

function fmtDateCol(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function cellStyle(count: number): Record<string, string> {
  if (!count) return {};
  if (count > 200) return { backgroundColor: "#FF8643", color: "#fff", fontWeight: "600" };
  if (count >= 50) return { backgroundColor: "#FFE6CF", color: "#2F313B" };
  return {};
}
</script>
