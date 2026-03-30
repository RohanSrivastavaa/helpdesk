<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">SLA Compliance</span>
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
          <!-- SLA Rate — gauge card -->
          <div class="rounded-xl border bg-surface-white p-5 flex flex-col items-center justify-center gap-2 col-span-2 sm:col-span-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">SLA Rate</span>
            <div class="relative flex items-center justify-center">
              <svg viewBox="0 0 36 36" class="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  :stroke="rateColor(data.summary.rate)"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="`${(data.summary.rate ?? 0) * 0.999} 100`"
                  stroke-dashoffset="0" />
              </svg>
              <span class="absolute text-xl font-bold" :class="rateTextColor(data.summary.rate)">
                {{ data.summary.rate != null ? `${data.summary.rate}%` : '—' }}
              </span>
            </div>
          </div>

          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Fulfilled</span>
            <span class="text-3xl font-bold text-green-600">{{ data.summary.fulfilled }}</span>
            <span class="text-xs text-ink-gray-4">within SLA</span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Breached</span>
            <span class="text-3xl font-bold" :class="data.summary.failed > 0 ? 'text-red-600' : 'text-ink-gray-5'">
              {{ data.summary.failed }}
            </span>
            <span class="text-xs text-ink-gray-4">SLA breaches</span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Avg FRT</span>
            <span class="text-3xl font-bold text-ink-gray-9">
              {{ data.avg_frt_sec != null ? fmtDuration(data.avg_frt_sec) : '—' }}
            </span>
            <span class="text-xs text-ink-gray-4">first response</span>
          </div>
        </div>

        <!-- ── Daily trend ────────────────────────────────────────── -->
        <div class="rounded-xl border bg-surface-white p-5" v-if="data.daily.length">
          <h3 class="text-sm font-semibold text-ink-gray-7 mb-4">Daily SLA Rate</h3>
          <div class="flex items-end gap-1 h-32">
            <div
              v-for="d in data.daily"
              :key="d.date"
              class="flex-1 flex flex-col items-center gap-1 group cursor-default"
            >
              <div class="w-full flex flex-col justify-end" style="height: 96px;">
                <div
                  class="w-full rounded-t transition-all"
                  :class="barColorClass(d.rate)"
                  :style="{ height: `${Math.max(4, (d.rate ?? 0) * 0.96)}px` }"
                />
              </div>
              <span class="text-xs text-ink-gray-4 whitespace-nowrap">{{ fmtDay(d.date) }}</span>
              <!-- Tooltip -->
              <div class="hidden group-hover:block absolute mb-1 bg-ink-gray-9 text-white text-xs rounded px-2 py-1 pointer-events-none">
                {{ d.date }}: {{ d.rate != null ? `${d.rate}%` : '—' }} ({{ d.fulfilled }}/{{ d.total }})
              </div>
            </div>
          </div>
        </div>

        <!-- ── By ticket type + by agent (2-col) ─────────────────── -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <!-- By Type -->
          <div class="rounded-xl border bg-surface-white p-4">
            <h3 class="text-sm font-semibold text-ink-gray-7 mb-3">By Ticket Type</h3>
            <div v-if="data.by_type.length" class="flex flex-col gap-2">
              <div v-for="row in data.by_type" :key="row.ticket_type" class="flex items-center gap-2">
                <span class="w-32 text-xs text-ink-gray-7 truncate">{{ row.ticket_type }}</span>
                <div class="flex-1 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                  <div class="h-2 rounded-full transition-all" :class="barColorClass(row.rate)"
                    :style="{ width: `${row.rate ?? 0}%` }" />
                </div>
                <span class="w-12 text-right text-xs font-semibold" :class="rateTextColor(row.rate)">
                  {{ row.rate != null ? `${row.rate}%` : '—' }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-ink-gray-4">No data</p>
          </div>

          <!-- By Agent -->
          <div class="rounded-xl border bg-surface-white p-4">
            <h3 class="text-sm font-semibold text-ink-gray-7 mb-3">By Agent</h3>
            <div v-if="data.by_agent.length" class="flex flex-col gap-2">
              <div v-for="row in data.by_agent" :key="row.agent" class="flex items-center gap-2">
                <span class="w-28 text-xs text-ink-gray-7 truncate">{{ row.agent_name }}</span>
                <div class="flex-1 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
                  <div class="h-2 rounded-full transition-all" :class="barColorClass(row.rate)"
                    :style="{ width: `${row.rate ?? 0}%` }" />
                </div>
                <span class="w-12 text-right text-xs font-semibold" :class="rateTextColor(row.rate)">
                  {{ row.rate != null ? `${row.rate}%` : '—' }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-ink-gray-4">No data</p>
          </div>
        </div>

        <div v-if="!data.summary.total" class="text-center py-12 text-ink-gray-4 text-sm">
          No SLA-tracked tickets found for this period.
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call } from "frappe-ui";
import { onMounted, ref } from "vue";

// Default: last 30 days
const today = new Date();
const toDate = ref(today.toISOString().slice(0, 10));
const fromDate = ref(new Date(today.setDate(today.getDate() - 30)).toISOString().slice(0, 10));

interface SLAData {
  summary: { total: number; fulfilled: number; failed: number; rate: number | null };
  avg_frt_sec: number | null;
  avg_resolution_sec: number | null;
  daily: { date: string; total: number; fulfilled: number; failed: number; rate: number | null }[];
  by_agent: { agent: string; agent_name: string; total: number; fulfilled: number; failed: number; rate: number | null }[];
  by_type: { ticket_type: string; total: number; fulfilled: number; failed: number; rate: number | null }[];
}

const data = ref<SLAData | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.sla_compliance.get_sla_compliance",
      { from_date: fromDate.value, to_date: toDate.value }
    );
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function rateColor(rate: number | null): string {
  if (rate == null) return "#9ca3af";
  if (rate >= 90) return "#22c55e";
  if (rate >= 70) return "#f59e0b";
  return "#ef4444";
}

function rateTextColor(rate: number | null): string {
  if (rate == null) return "text-ink-gray-4";
  if (rate >= 90) return "text-green-600";
  if (rate >= 70) return "text-amber-600";
  return "text-red-600";
}

function barColorClass(rate: number | null): string {
  if (rate == null) return "bg-surface-gray-3";
  if (rate >= 90) return "bg-green-500";
  if (rate >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
</script>
