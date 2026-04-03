<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideActivity class="h-4 w-4 text-ink-gray-5" />
          <span class="text-base font-semibold text-ink-gray-9">Agent Performance</span>
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
          <button v-if="rows.length"
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
    <div v-if="perfSummary" class="flex items-center gap-6 px-6 py-3 border-b border-outline-gray-2 bg-white text-sm">
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9 tabular-nums">{{ perfSummary.total_assigned }}</span>
        <span class="text-ink-gray-5">assigned</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span class="font-semibold text-ink-gray-9 tabular-nums">{{ perfSummary.total_resolved }}</span>
        <span class="text-ink-gray-5">resolved</span>
      </div>
      <div class="w-px h-4 bg-outline-gray-2" />
      <div class="flex items-center gap-1.5">
        <span class="font-semibold tabular-nums"
          :class="(perfSummary.resolution_rate ?? 0) >= 80 ? 'text-green-700' : (perfSummary.resolution_rate ?? 0) >= 50 ? 'text-amber-700' : 'text-red-600'">
          {{ perfSummary.resolution_rate ?? '—' }}%
        </span>
        <span class="text-ink-gray-5">resolution rate</span>
      </div>
    </div>

    <div class="flex-1 min-h-0 px-6 py-5 flex flex-col gap-5 overflow-hidden">
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin border-ink-gray-4" />
        <p class="text-sm text-ink-gray-5">Loading…</p>
      </div>

      <div v-else-if="!rows.length" class="flex flex-col items-center justify-center h-48 gap-2 text-ink-gray-4">
        <LucideUsers class="h-10 w-10 opacity-30" />
        <p class="text-sm">No data for this period</p>
      </div>

      <template v-else>
        <ShiftBlock class="flex-1 min-h-0" title="Shift 1 — 6:00–14:59" :shift-rows="shift1Rows" :dates="dates" :matrix="shift1Matrix" />
        <ShiftBlock class="flex-1 min-h-0" title="Shift 2 — 15:00–23:59" :shift-rows="shift2Rows" :dates="dates" :matrix="shift2Matrix" />

        <div class="flex items-center gap-5 text-xs text-ink-gray-4 pb-2">
          <span class="flex items-center gap-1.5"><span class="font-semibold text-green-700">■</span> 100% resolved</span>
          <span class="flex items-center gap-1.5"><span class="font-semibold text-gray-700">■</span> Partial</span>
          <span class="flex items-center gap-1.5"><span class="font-semibold text-red-600">■</span> None resolved</span>
          <span class="flex items-center gap-1.5"><span class="text-gray-400">■</span> Absent</span>
          <span class="text-ink-gray-3 ml-2">% &gt;30m = of resolved tickets, % that took over 30 min</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { call } from "frappe-ui";
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import LucideActivity from "~icons/lucide/activity";
import LucideDownload from "~icons/lucide/download";
import LucideRefreshCw from "~icons/lucide/refresh-cw";
import LucideTimer from "~icons/lucide/timer";
import LucideUsers from "~icons/lucide/users";

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

interface PerfRow {
  agent: string; agent_name: string;
  date: string; shift: number;
  tickets_assigned: number; tickets_resolved: number; pct_tt_over_30m: number | null;
}

interface PerfSummary {
  total_assigned: number; total_resolved: number; resolution_rate: number | null;
}

const rows       = ref<PerfRow[]>([]);
const perfSummary = ref<PerfSummary | null>(null);
const loading    = ref(false);

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
    const [rowData, summaryData] = await Promise.all([
      call("fitelo_helpdesk.fitelo_helpdesk.api.dashboards.get_agent_performance",
        { from_date: fromDate.value, to_date: toDate.value }),
      call("fitelo_helpdesk.fitelo_helpdesk.api.dashboards.get_performance_summary",
        { from_date: fromDate.value, to_date: toDate.value }),
    ]);
    rows.value = rowData;
    perfSummary.value = summaryData;
  } finally {
    loading.value = false;
  }
}

function downloadCSV() {
  const headers = ["Agent", "Date", "Shift", "Assigned", "Resolved", "% >30m"];
  const csvRows = [headers.map((h) => `"${h}"`).join(",")];
  for (const r of rows.value) {
    csvRows.push([r.agent_name, r.date, r.shift, r.tickets_assigned, r.tickets_resolved, r.pct_tt_over_30m ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `agent-performance-${fromDate.value}-to-${toDate.value}.csv`; a.click();
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

const shift1Rows = computed(() => uniqueAgents(rows.value.filter((r) => r.shift === 1)));
const shift2Rows = computed(() => uniqueAgents(rows.value.filter((r) => r.shift === 2)));

function uniqueAgents(data: PerfRow[]) {
  const seen = new Set<string>();
  const out: { agent: string; agent_name: string }[] = [];
  for (const r of data) {
    if (!seen.has(r.agent)) { seen.add(r.agent); out.push({ agent: r.agent, agent_name: r.agent_name }); }
  }
  return out.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
}

type ShiftMatrix = Record<string, Record<string, PerfRow>>;

const shift1Matrix = computed<ShiftMatrix>(() => buildMatrix(rows.value.filter((r) => r.shift === 1)));
const shift2Matrix = computed<ShiftMatrix>(() => buildMatrix(rows.value.filter((r) => r.shift === 2)));

function buildMatrix(data: PerfRow[]): ShiftMatrix {
  const m: ShiftMatrix = {};
  for (const r of data) {
    if (!m[r.agent]) m[r.agent] = {};
    m[r.agent][r.date] = r;
  }
  return m;
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

// ── ShiftBlock ────────────────────────────────────────────────────────────────
const ShiftBlock = defineComponent({
  props: {
    title:     { type: String, required: true },
    shiftRows: { type: Array as () => { agent: string; agent_name: string }[], required: true },
    dates:     { type: Array as () => string[], required: true },
    matrix:    { type: Object as () => ShiftMatrix, required: true },
  },
  setup(props) {
    function fmtCol(d: string) {
      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    }
    function cell(agent: string, date: string): PerfRow | null {
      return props.matrix[agent]?.[date] ?? null;
    }
    function agentTotal(agent: string): { assigned: number; resolved: number } {
      let assigned = 0, resolved = 0;
      for (const d of props.dates) {
        const c = cell(agent, d);
        if (c) { assigned += c.tickets_assigned; resolved += c.tickets_resolved; }
      }
      return { assigned, resolved };
    }
    function dateTotal(date: string) {
      let assigned = 0, resolved = 0;
      for (const row of props.shiftRows) {
        const c = cell(row.agent, date);
        if (c) { assigned += c.tickets_assigned; resolved += c.tickets_resolved; }
      }
      return { assigned, resolved };
    }
    function cellTextColor(c: PerfRow | null): string {
      if (!c || c.tickets_assigned === 0) return "#9ca3af"; // gray — absent
      if (c.tickets_resolved >= c.tickets_assigned) return "#15803d"; // green-700
      if (c.tickets_resolved === 0) return "#dc2626"; // red-600
      return "#374151"; // gray-700 — partial
    }
    function pct(c: PerfRow | null): string {
      if (!c || c.pct_tt_over_30m == null) return "—";
      return `${c.pct_tt_over_30m}%`;
    }
    const sticky = "box-shadow: 2px 0 4px rgba(0,0,0,0.05)";

    return () => h("div", { class: "rounded-lg overflow-hidden border border-outline-gray-2 flex flex-col min-h-0" }, [
      // Header
      h("div", { class: "flex items-center gap-2 px-4 py-2 bg-surface-gray-2 border-b border-outline-gray-2 flex-shrink-0" }, [
        h("span", { class: "text-xs font-semibold text-ink-gray-7 uppercase tracking-wide" }, props.title),
        h("span", { class: "ml-auto text-xs text-ink-gray-4" },
          `${props.shiftRows.length} agent${props.shiftRows.length !== 1 ? 's' : ''}`),
      ]),
      h("div", { class: "flex-1 min-h-0 overflow-auto bg-white" }, [
        h("table", { class: "text-xs border-collapse", style: "min-width: max-content; width: 100%" }, [
          h("thead", { style: "position: sticky; top: 0; z-index: 30" }, [
            h("tr", { class: "bg-surface-gray-1 border-b border-outline-gray-2" }, [
              h("th", {
                rowspan: 2,
                class: "sticky left-0 z-20 bg-surface-gray-1 px-4 py-2 text-left text-xs font-semibold text-ink-gray-5 uppercase tracking-wide border-r border-outline-gray-2 min-w-[180px]",
                style: sticky,
              }, "Agent"),
              ...props.dates.flatMap((d) => [
                h("th", { colspan: 3, class: "px-3 py-2 text-center font-semibold text-ink-gray-6 border-r border-outline-gray-2 whitespace-nowrap" }, fmtCol(d)),
              ]),
              h("th", { colspan: 2, class: "px-3 py-2 text-center font-semibold text-ink-gray-6 whitespace-nowrap bg-surface-gray-2" }, "Total"),
            ]),
            h("tr", { class: "bg-surface-gray-1 border-b border-outline-gray-2" }, [
              ...props.dates.flatMap((d) => [
                h("th", { key: d+"-a", class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium border-l border-outline-gray-2 min-w-[70px]" }, "Assigned"),
                h("th", { key: d+"-r", class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium min-w-[70px]" }, "Resolved"),
                h("th", { key: d+"-p", class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium border-r border-outline-gray-2 min-w-[60px]" }, ">30m"),
              ]),
              h("th", { class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium border-l border-outline-gray-2 min-w-[55px] bg-surface-gray-2" }, "In"),
              h("th", { class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium min-w-[55px] bg-surface-gray-2" }, "Out"),
            ]),
          ]),
          h("tbody", {}, [
            // Totals row
            h("tr", { class: "border-b border-outline-gray-2 bg-surface-gray-1" }, [
              h("td", {
                class: "sticky left-0 z-10 bg-surface-gray-1 px-4 py-2 border-r border-outline-gray-2 font-semibold text-ink-gray-6 text-xs uppercase tracking-wide",
                style: sticky,
              }, "Total"),
              ...props.dates.flatMap((d) => {
                const t = dateTotal(d);
                return [
                  h("td", { class: "px-3 py-2 text-center border-l border-outline-gray-2 font-semibold text-ink-gray-7" }, t.assigned || "—"),
                  h("td", { class: "px-3 py-2 text-center font-semibold text-ink-gray-7" }, t.resolved || "—"),
                  h("td", { class: "px-3 py-2 text-center border-r border-outline-gray-2 text-ink-gray-4" }, "—"),
                ];
              }),
              h("td", { class: "px-3 py-2 text-center border-l border-outline-gray-2 font-semibold text-ink-gray-7 bg-surface-gray-1" }, "—"),
              h("td", { class: "px-3 py-2 text-center font-semibold text-ink-gray-7 bg-surface-gray-1" }, "—"),
            ]),
            // Agent rows
            ...props.shiftRows.map((agentRow) => {
              const tot = agentTotal(agentRow.agent);
              return h("tr", { key: agentRow.agent, class: "border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1 transition-colors" }, [
                h("td", { class: "sticky left-0 z-10 bg-white px-4 py-2 border-r border-outline-gray-2 whitespace-nowrap", style: sticky }, [
                  h("div", { class: "flex items-center gap-2" }, [
                    h("div", {
                      class: "flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold flex-shrink-0",
                      style: `background:${avatarColor(agentRow.agent_name)}`,
                    }, initials(agentRow.agent_name)),
                    h("span", { class: "font-medium text-ink-gray-8" }, agentRow.agent_name),
                  ]),
                ]),
                ...props.dates.flatMap((d) => {
                  const c = cell(agentRow.agent, d);
                  const color = cellTextColor(c);
                  return [
                    h("td", { class: "px-3 py-2 text-center border-l border-outline-gray-2 font-medium", style: { color } }, c?.tickets_assigned ?? "—"),
                    h("td", { class: "px-3 py-2 text-center font-medium", style: { color } }, c?.tickets_resolved ?? "—"),
                    h("td", { class: "px-3 py-2 text-center border-r border-outline-gray-2 text-xs text-ink-gray-4" }, pct(c)),
                  ];
                }),
                h("td", { class: "px-3 py-2 text-center border-l border-outline-gray-2 font-semibold text-ink-gray-8 bg-surface-gray-1" }, tot.assigned || "—"),
                h("td", { class: "px-3 py-2 text-center font-semibold text-ink-gray-8 bg-surface-gray-1" }, tot.resolved || "—"),
              ]);
            }),
          ]),
        ]),
      ]),
    ]);
  },
});
</script>
