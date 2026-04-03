<template>
  <div class="flex flex-col h-full bg-surface-gray-1">
    <LayoutHeader>
      <template #left-header>
        <div class="flex items-center gap-2">
          <LucideTimer class="h-4 w-4 text-ink-gray-5" />
          <span class="text-base font-semibold text-ink-gray-9">Agent Timing</span>
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

    <div class="flex-1 min-h-0 px-6 py-5 flex flex-col gap-6 overflow-hidden">
      <div v-if="loading" class="flex flex-col items-center justify-center h-48 gap-3">
        <div class="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color:#FF8643; border-top-color:transparent" />
        <p class="text-sm text-ink-gray-5">Loading data…</p>
      </div>

      <div v-else-if="!rows.length" class="flex flex-col items-center justify-center h-48 gap-3 text-ink-gray-4">
        <LucideClock class="h-12 w-12 opacity-40" />
        <p class="text-sm font-medium">No data for this period</p>
        <p class="text-xs text-ink-gray-3">Try a wider date range</p>
      </div>

      <template v-else>
        <TimingBlock class="flex-1 min-h-0" title="Shift 1 — 5:00–14:59" :shift="1"
          :shift-rows="shift1Rows" :dates="dates" :matrix="shift1Matrix" />
        <TimingBlock class="flex-1 min-h-0" title="Shift 2 — 15:00–23:59" :shift="2"
          :shift-rows="shift2Rows" :dates="dates" :matrix="shift2Matrix" />

        <!-- Legend -->
        <div class="flex items-center gap-5 text-xs text-ink-gray-4 pb-2">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded" style="background:#FFB6C1" />
            ⚠ Late login / late first ticket / early end
          </span>
          <span class="text-ink-gray-3">
            Shift 1: flag if login or 1st ticket &gt; 06:30, or last ticket &lt; 14:00 &nbsp;·&nbsp;
            Shift 2: flag if login or 1st ticket &gt; 16:00, or last ticket &lt; 23:00
          </span>
        </div>
      </template>
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

interface TimingRow {
  agent: string; agent_name: string;
  date: string; shift: number;
  login_time: string | null;
  first_resolved: string | null; last_resolved: string | null;
  count: number;
}

const rows    = ref<TimingRow[]>([]);
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
      "fitelo_helpdesk.fitelo_helpdesk.api.dashboards.get_agent_timing",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}

function downloadCSV() {
  const headers = ["Agent", "Date", "Shift", "Login", "1st Resolved", "Last Resolved", "Count"];
  const csvRows = [headers.map((h) => `"${h}"`).join(",")];
  for (const r of rows.value) {
    csvRows.push([r.agent_name, r.date, r.shift, r.login_time ?? "", r.first_resolved ?? "", r.last_resolved ?? "", r.count]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agent-timing-${fromDate.value}-to-${toDate.value}.csv`;
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

const shift1Rows = computed(() => uniqueAgents(rows.value.filter((r) => r.shift === 1)));
const shift2Rows = computed(() => uniqueAgents(rows.value.filter((r) => r.shift === 2)));

function uniqueAgents(data: TimingRow[]) {
  const seen = new Set<string>();
  const out: { agent: string; agent_name: string }[] = [];
  for (const r of data) {
    if (!seen.has(r.agent)) { seen.add(r.agent); out.push({ agent: r.agent, agent_name: r.agent_name }); }
  }
  return out.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
}

type TimingMatrix = Record<string, Record<string, TimingRow>>;

const shift1Matrix = computed<TimingMatrix>(() => buildMatrix(rows.value.filter((r) => r.shift === 1)));
const shift2Matrix = computed<TimingMatrix>(() => buildMatrix(rows.value.filter((r) => r.shift === 2)));

function buildMatrix(data: TimingRow[]): TimingMatrix {
  const m: TimingMatrix = {};
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
  const colors = ["#FF8643", "#99E8D3", "#6366F1", "#F59E0B", "#10B981", "#3B82F6", "#EC4899"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── TimingBlock component ────────────────────────────────────────────────────
const TimingBlock = defineComponent({
  props: {
    title:     { type: String, required: true },
    shift:     { type: Number, required: true },
    shiftRows: { type: Array as () => { agent: string; agent_name: string }[], required: true },
    dates:     { type: Array as () => string[], required: true },
    matrix:    { type: Object as () => TimingMatrix, required: true },
  },
  setup(props) {
    function fmtCol(d: string) {
      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    }

    function toMins(t: string | null): number | null {
      if (!t) return null;
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    }

    function fmtTime(t: string | null): string {
      return t ? t.slice(0, 5) : "—";
    }

    function isLateStart(t: string | null): boolean {
      const m = toMins(t);
      if (m === null) return false;
      return props.shift === 1 ? m > 6 * 60 + 30 : m > 16 * 60;
    }

    function isEarlyEnd(t: string | null): boolean {
      const m = toMins(t);
      if (m === null) return false;
      return props.shift === 1 ? m < 14 * 60 : m < 23 * 60;
    }

    function cell(agent: string, date: string): TimingRow | null {
      return props.matrix[agent]?.[date] ?? null;
    }

    const PINK  = { backgroundColor: "#FFB6C1", color: "#2F313B", fontWeight: "600" };
    const EMPTY = {};
    const stickyStyle = "box-shadow: 2px 0 6px rgba(0,0,0,0.07)";

    return () => h("div", { class: "rounded-lg overflow-hidden border border-outline-gray-2 flex flex-col min-h-0" }, [
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
                style: stickyStyle,
              }, "Agent"),
              ...props.dates.flatMap((d) => [
                h("th", {
                  colspan: 4,
                  class: "px-4 py-2 text-center font-semibold text-ink-gray-6 border-r border-outline-gray-2 whitespace-nowrap",
                }, fmtCol(d)),
              ]),
            ]),
            h("tr", { class: "bg-surface-gray-1 border-b border-outline-gray-2" }, [
              ...props.dates.flatMap((d) => [
                h("th", { key: d+"-lg", class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium whitespace-nowrap border-l border-outline-gray-2 min-w-[68px]" }, "Login"),
                h("th", { key: d+"-f",  class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium whitespace-nowrap min-w-[68px]" }, "1st Resolved"),
                h("th", { key: d+"-l",  class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium whitespace-nowrap min-w-[68px]" }, "Last Resolved"),
                h("th", { key: d+"-c",  class: "px-3 py-1.5 text-center text-ink-gray-4 font-medium whitespace-nowrap border-r border-outline-gray-2 min-w-[44px]" }, "#"),
              ]),
            ]),
          ]),
          h("tbody", {}, [
            ...props.shiftRows.map((agentRow) =>
              h("tr", { key: agentRow.agent, class: "border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1 transition-colors" }, [
                h("td", {
                  class: "sticky left-0 z-10 bg-white px-4 py-2 border-r border-outline-gray-2 whitespace-nowrap",
                  style: stickyStyle,
                }, [
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
                  const firstFlagged = isLateStart(c?.first_resolved ?? null);
                  const lastFlagged  = isEarlyEnd(c?.last_resolved ?? null);
                  const loginFlagged = isLateStart(c?.login_time ?? null);
                  const noTickets    = c && c.count === 0;
                  return [
                    // Login time
                    h("td", {
                      class: "px-3 py-2 text-center border-l border-outline-gray-2 font-mono",
                      style: loginFlagged ? PINK : { color: "#6b7280" },
                    }, [
                      fmtTime(c?.login_time ?? null),
                      loginFlagged ? h("span", { class: "ml-0.5 text-[10px]" }, "⚠") : null,
                    ]),
                    // 1st ticket resolved
                    h("td", {
                      class: "px-3 py-2 text-center font-mono text-ink-gray-7",
                      style: firstFlagged ? PINK : EMPTY,
                    }, [
                      fmtTime(c?.first_resolved ?? null),
                      firstFlagged ? h("span", { class: "ml-0.5 text-[10px]" }, "⚠") : null,
                    ]),
                    // Last ticket resolved
                    h("td", {
                      class: "px-3 py-2 text-center font-mono text-ink-gray-7",
                      style: lastFlagged ? PINK : EMPTY,
                    }, [
                      fmtTime(c?.last_resolved ?? null),
                      lastFlagged ? h("span", { class: "ml-0.5 text-[10px]" }, "⚠") : null,
                    ]),
                    // Count
                    h("td", {
                      class: "px-3 py-2 text-center border-r border-outline-gray-2 font-semibold tabular-nums",
                      style: noTickets ? { color: "#ef4444" } : { color: "#374151" },
                    }, c ? (c.count ?? "—") : "—"),
                  ];
                }),
              ])
            ),
          ]),
        ]),
      ]),
    ]);
  },
});
</script>
