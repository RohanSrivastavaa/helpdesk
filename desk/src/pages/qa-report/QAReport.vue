<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="border-b px-6 py-4 flex items-center justify-between shrink-0">
      <h1 class="text-xl font-semibold text-ink-gray-9">QA Report</h1>
      <div class="flex items-center gap-3">
        <input type="date" v-model="fromDate" class="rounded border border-outline-gray-2 px-2 py-1.5 text-sm" />
        <span class="text-ink-gray-5 text-sm">to</span>
        <input type="date" v-model="toDate" class="rounded border border-outline-gray-2 px-2 py-1.5 text-sm" />
        <Button variant="solid" :loading="loading" @click="load">Load</Button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      <!-- Summary cards -->
      <div v-if="report" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-xl border border-outline-gray-2 bg-surface-white px-4 py-4 flex flex-col gap-1"
        >
          <span class="text-xs text-ink-gray-5 uppercase tracking-wide">{{ card.label }}</span>
          <span class="text-2xl font-bold" :class="card.color">{{ card.value }}</span>
        </div>
      </div>

      <!-- Agent breakdown table -->
      <div v-if="report?.by_agent?.length" class="rounded-xl border border-outline-gray-2 bg-surface-white overflow-hidden">
        <div class="px-4 py-3 border-b border-outline-gray-2">
          <h2 class="text-sm font-semibold text-ink-gray-8">Score by Agent</h2>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-outline-gray-2 bg-surface-gray-1">
              <th class="px-4 py-2 text-left text-xs text-ink-gray-5 font-medium">Agent</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Rated</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Overall</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Comm.</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Resolution</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Speed</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Policy</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in report.by_agent"
              :key="row.agent"
              class="border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1"
            >
              <td class="px-4 py-2 font-medium text-ink-gray-8">{{ row.agent }}</td>
              <td class="px-4 py-2 text-center text-ink-gray-6">{{ row.count }}</td>
              <td class="px-4 py-2 text-center font-semibold" :class="scoreColor(row.avg_overall)">
                {{ fmt(row.avg_overall) }}
              </td>
              <td class="px-4 py-2 text-center" :class="scoreColor(row.avg_comm)">{{ fmt(row.avg_comm) }}</td>
              <td class="px-4 py-2 text-center" :class="scoreColor(row.avg_resolution)">{{ fmt(row.avg_resolution) }}</td>
              <td class="px-4 py-2 text-center" :class="scoreColor(row.avg_speed)">{{ fmt(row.avg_speed) }}</td>
              <td class="px-4 py-2 text-center" :class="scoreColor(row.avg_policy)">{{ fmt(row.avg_policy) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty / loading state -->
      <div v-else-if="!loading && loaded" class="flex items-center justify-center h-40 text-ink-gray-4 text-sm">
        No quality scores found for this period.
      </div>
      <div v-else-if="loading" class="flex items-center justify-center h-40 text-ink-gray-4 text-sm">
        Loading…
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button, call } from "frappe-ui";
import { computed, ref } from "vue";

interface AgentRow {
  agent: string;
  count: number;
  avg_overall: number;
  avg_comm: number;
  avg_resolution: number;
  avg_speed: number;
  avg_policy: number;
}

interface Report {
  summary: { total_scored: number; avg_overall: number; avg_comm: number; avg_resolution: number };
  by_agent: AgentRow[];
}

// Default to last 30 days
const today = new Date();
const thirtyAgo = new Date(today);
thirtyAgo.setDate(thirtyAgo.getDate() - 30);
const fmt2 = (d: Date) => d.toISOString().slice(0, 10);

const fromDate = ref(fmt2(thirtyAgo));
const toDate = ref(fmt2(today));
const report = ref<Report | null>(null);
const loading = ref(false);
const loaded = ref(false);

async function load() {
  loading.value = true;
  loaded.value = false;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.quality.get_qa_report",
      { from_date: fromDate.value, to_date: toDate.value }
    );
    report.value = result;
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

const summaryCards = computed(() => {
  if (!report.value) return [];
  const s = report.value.summary;
  return [
    { label: "Tickets Scored", value: s.total_scored, color: "text-ink-gray-9" },
    { label: "Avg Overall", value: fmt(s.avg_overall), color: scoreColor(s.avg_overall) },
    { label: "Avg Comm.", value: fmt(s.avg_comm), color: scoreColor(s.avg_comm) },
    { label: "Avg Resolution", value: fmt(s.avg_resolution), color: scoreColor(s.avg_resolution) },
  ];
});

function fmt(n: number): string {
  if (!n) return "—";
  return n.toFixed(2);
}

function scoreColor(s: number): string {
  if (!s) return "text-ink-gray-4";
  if (s >= 4) return "text-green-600";
  if (s >= 3) return "text-amber-600";
  return "text-red-600";
}

// Load on mount
load();
</script>
