<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="border-b px-6 py-4 shrink-0">
      <h1 class="text-xl font-semibold text-ink-gray-9">My Stats</h1>
      <p class="text-sm text-ink-gray-5 mt-0.5">Your personal performance — last 30 days</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center flex-1 text-ink-gray-4 text-sm">Loading…</div>

    <div v-else-if="stats" class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div
          v-for="card in kpiCards"
          :key="card.label"
          class="rounded-xl border border-outline-gray-2 bg-surface-white px-4 py-4 flex flex-col gap-1"
        >
          <span class="text-xs text-ink-gray-5 uppercase tracking-wide">{{ card.label }}</span>
          <span class="text-2xl font-bold" :class="card.color">{{ card.value }}</span>
          <span v-if="card.sub" class="text-xs text-ink-gray-4">{{ card.sub }}</span>
        </div>
      </div>

      <!-- Recent resolved tickets -->
      <div v-if="stats.recent_resolved.length" class="rounded-xl border border-outline-gray-2 bg-surface-white overflow-hidden">
        <div class="px-4 py-3 border-b border-outline-gray-2">
          <h2 class="text-sm font-semibold text-ink-gray-8">Recently Resolved</h2>
        </div>
        <div class="divide-y divide-outline-gray-2">
          <div
            v-for="t in stats.recent_resolved"
            :key="t.name"
            class="px-4 py-3 flex items-center gap-3 hover:bg-surface-gray-1 cursor-pointer"
            @click="$router.push({ name: 'TicketAgent', params: { ticketId: t.name } })"
          >
            <span class="font-mono text-xs text-ink-gray-4 w-24 shrink-0">{{ t.name }}</span>
            <span class="flex-1 text-sm text-ink-gray-8 truncate">{{ t.subject }}</span>
            <span v-if="t.priority" class="text-xs shrink-0" :class="priorityColor(t.priority)">{{ t.priority }}</span>
            <span v-if="t.feedback_rating" class="text-xs text-amber-500 shrink-0">
              {{ '⭐'.repeat(Math.round((t.feedback_rating || 0) * 5)) }}
            </span>
            <span class="text-xs text-ink-gray-4 shrink-0">{{ fmtDate(t.resolution_date) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

interface Stats {
  open_tickets: number;
  resolved_week: number;
  resolved_month: number;
  avg_frt_sec: number;
  avg_csat_stars: number | null;
  avg_quality: number | null;
  recent_resolved: Array<{
    name: string; subject: string; status: string; priority: string;
    resolution_date: string; feedback_rating: number | null;
  }>;
}

const stats = ref<Stats | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    stats.value = await call("fitelo_helpdesk.fitelo_helpdesk.api.my_stats.get_my_stats");
  } finally {
    loading.value = false;
  }
}

function fmtFrt(sec: number): string {
  if (!sec) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

const kpiCards = computed(() => {
  if (!stats.value) return [];
  const s = stats.value;
  return [
    {
      label: "Open Tickets",
      value: s.open_tickets,
      color: s.open_tickets > 10 ? "text-red-600" : s.open_tickets > 5 ? "text-amber-600" : "text-ink-gray-9",
    },
    {
      label: "Resolved (7d)",
      value: s.resolved_week,
      color: "text-green-600",
    },
    {
      label: "Resolved (30d)",
      value: s.resolved_month,
      color: "text-green-600",
    },
    {
      label: "Avg Response",
      value: fmtFrt(s.avg_frt_sec),
      color: "text-blue-600",
      sub: "First response time",
    },
    {
      label: "Avg CSAT",
      value: s.avg_csat_stars != null ? `${s.avg_csat_stars.toFixed(1)} ⭐` : "—",
      color: s.avg_csat_stars != null
        ? s.avg_csat_stars >= 4 ? "text-green-600" : s.avg_csat_stars >= 3 ? "text-amber-600" : "text-red-600"
        : "text-ink-gray-4",
    },
    {
      label: "Avg Quality",
      value: s.avg_quality != null ? s.avg_quality.toFixed(2) : "—",
      color: s.avg_quality != null
        ? s.avg_quality >= 4 ? "text-green-600" : s.avg_quality >= 3 ? "text-amber-600" : "text-red-600"
        : "text-ink-gray-4",
      sub: "QA score / 5",
    },
  ];
});

function priorityColor(p: string): string {
  return ({ Urgent: "text-red-600", High: "text-orange-500", Medium: "text-amber-600", Low: "text-green-600" } as Record<string,string>)[p] ?? "text-ink-gray-5";
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

onMounted(load);
</script>
