<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">Ticket Aging Report</span>
      </template>
      <template #right-header>
        <span class="text-xs text-ink-gray-4">
          {{ data ? `As of ${formatTime(data.as_of)}` : '' }}
        </span>
        <Button size="sm" :loading="loading" @click="load">Refresh</Button>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

      <div v-if="loading && !data" class="flex items-center justify-center h-40 text-ink-gray-4">
        Loading…
      </div>

      <template v-else-if="data">

        <!-- ── Summary cards ──────────────────────────────────────── -->
        <div class="grid grid-cols-3 gap-4">
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Open Tickets</span>
            <span class="text-3xl font-bold text-ink-gray-9">{{ data.total_open }}</span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Avg Age</span>
            <span class="text-3xl font-bold" :class="ageClass(data.avg_age_sec)">
              {{ data.avg_age_sec != null ? formatDuration(data.avg_age_sec) : '—' }}
            </span>
          </div>
          <div class="rounded-xl border bg-surface-white p-4 flex flex-col gap-1">
            <span class="text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Oldest Ticket</span>
            <span class="text-3xl font-bold" :class="ageClass(data.oldest_sec)">
              {{ data.oldest_sec != null ? formatDuration(data.oldest_sec) : '—' }}
            </span>
          </div>
        </div>

        <!-- ── Bucket bars ─────────────────────────────────────────── -->
        <div class="rounded-xl border bg-surface-white p-5">
          <h3 class="text-sm font-semibold text-ink-gray-7 mb-4">Age Distribution</h3>
          <div class="flex flex-col gap-3">
            <div
              v-for="bucket in data.buckets"
              :key="bucket.key"
              class="flex items-center gap-3 cursor-pointer group"
              @click="toggleBucket(bucket.key)"
            >
              <!-- Label -->
              <span class="w-24 text-sm text-ink-gray-7 shrink-0">{{ bucket.label }}</span>

              <!-- Bar -->
              <div class="flex-1 bg-surface-gray-2 rounded-full h-5 overflow-hidden relative">
                <div
                  class="h-5 rounded-full transition-all flex items-center pl-2"
                  :class="bucketBarClass(bucket.key)"
                  :style="{ width: barWidth(bucket.count) }"
                >
                  <span
                    v-if="bucket.count && barPct(bucket.count) > 15"
                    class="text-xs font-semibold text-white"
                  >
                    {{ bucket.count }}
                  </span>
                </div>
              </div>

              <!-- Count badge -->
              <span
                class="w-8 text-right text-sm font-semibold shrink-0"
                :class="bucket.count ? bucketTextClass(bucket.key) : 'text-ink-gray-3'"
              >
                {{ bucket.count }}
              </span>

              <!-- Expand indicator -->
              <span class="text-ink-gray-3 group-hover:text-ink-gray-6 transition-colors shrink-0">
                {{ expandedBucket === bucket.key ? '▲' : '▼' }}
              </span>
            </div>
          </div>
        </div>

        <!-- ── Expanded bucket ticket list ───────────────────────── -->
        <div
          v-if="expandedBucket && expandedTickets.length"
          class="rounded-xl border overflow-hidden bg-surface-white"
        >
          <div class="px-4 py-3 border-b bg-surface-gray-1 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-ink-gray-7">
              {{ expandedBucketLabel }} · {{ expandedTickets.length }} ticket{{ expandedTickets.length !== 1 ? 's' : '' }}
            </h3>
            <div class="flex items-center gap-3 text-xs text-ink-gray-4">
              Sort by:
              <button
                v-for="col in sortCols"
                :key="col.key"
                class="hover:text-ink-gray-8 transition-colors font-medium"
                :class="sortKey === col.key ? 'text-ink-gray-8 underline' : ''"
                @click="sortBy(col.key)"
              >
                {{ col.label }}
                <span v-if="sortKey === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
              </button>
            </div>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-surface-gray-1 text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">
                <th class="px-4 py-2 text-left">Ticket</th>
                <th class="px-4 py-2 text-left">Subject</th>
                <th class="px-4 py-2 text-center">Priority</th>
                <th class="px-4 py-2 text-center">Status</th>
                <th class="px-4 py-2 text-center">Source</th>
                <th class="px-4 py-2 text-left">Assignee</th>
                <th class="px-4 py-2 text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in sortedTickets"
                :key="t.name"
                class="border-b last:border-0 hover:bg-surface-gray-1 transition-colors cursor-pointer"
                @click="openTicket(t.name)"
              >
                <td class="px-4 py-2.5">
                  <span class="font-mono text-xs text-ink-gray-5">{{ t.name }}</span>
                </td>
                <td class="px-4 py-2.5 max-w-xs truncate text-ink-gray-8">
                  {{ t.subject }}
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span
                    class="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                    :class="priorityClass(t.priority)"
                  >
                    {{ t.priority || '—' }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-center text-xs text-ink-gray-6">{{ t.status }}</td>
                <td class="px-4 py-2.5 text-center text-xs text-ink-gray-5">
                  {{ t.ticket_source || '—' }}
                </td>
                <td class="px-4 py-2.5 text-xs text-ink-gray-6 max-w-[10rem] truncate">
                  {{ t.assignee || 'Unassigned' }}
                </td>
                <td class="px-4 py-2.5 text-right font-semibold" :class="ageClass(t.age_sec)">
                  {{ formatDuration(t.age_sec) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-else-if="expandedBucket"
          class="text-center text-sm text-ink-gray-4 py-6"
        >
          No tickets in this bucket.
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { useRouter } from "vue-router";
import { Button, call } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

const router = useRouter();

// ── Types ──────────────────────────────────────────────────────────────────
interface Ticket {
  name: string;
  subject: string;
  raised_by: string;
  status: string;
  priority: string;
  ticket_type: string;
  ticket_source: string;
  assignee: string | null;
  age_sec: number;
}

interface Bucket {
  key: string;
  label: string;
  count: number;
  tickets: Ticket[];
}

interface AgingData {
  as_of: string;
  total_open: number;
  oldest_sec: number | null;
  avg_age_sec: number | null;
  buckets: Bucket[];
}

// ── State ──────────────────────────────────────────────────────────────────
const data    = ref<AgingData | null>(null);
const loading = ref(false);
const expandedBucket = ref<string | null>(null);
const sortKey = ref<string>("age_sec");
const sortDir = ref<"asc" | "desc">("desc");

// ── Fetch ──────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.aging.get_ticket_aging"
    );
    // Auto-expand first non-empty bucket
    if (!expandedBucket.value && data.value) {
      const first = data.value.buckets.find(b => b.count > 0);
      if (first) expandedBucket.value = first.key;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ── Bucket interaction ─────────────────────────────────────────────────────
function toggleBucket(key: string) {
  expandedBucket.value = expandedBucket.value === key ? null : key;
}

const expandedTickets = computed(() =>
  data.value?.buckets.find(b => b.key === expandedBucket.value)?.tickets ?? []
);

const expandedBucketLabel = computed(() =>
  data.value?.buckets.find(b => b.key === expandedBucket.value)?.label ?? ""
);

// ── Sorting ────────────────────────────────────────────────────────────────
const sortCols = [
  { key: "age_sec",  label: "Age"      },
  { key: "priority", label: "Priority" },
  { key: "status",   label: "Status"   },
];

const PRIORITY_ORDER: Record<string, number> = {
  Urgent: 4, High: 3, Medium: 2, Low: 1,
};

function sortBy(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = "desc";
  }
}

const sortedTickets = computed(() => {
  const tickets = [...expandedTickets.value];
  return tickets.sort((a, b) => {
    let av: number, bv: number;
    if (sortKey.value === "priority") {
      av = PRIORITY_ORDER[a.priority] ?? 0;
      bv = PRIORITY_ORDER[b.priority] ?? 0;
    } else {
      av = (a as any)[sortKey.value] ?? 0;
      bv = (b as any)[sortKey.value] ?? 0;
    }
    return sortDir.value === "asc" ? av - bv : bv - av;
  });
});

// ── Navigation ─────────────────────────────────────────────────────────────
function openTicket(name: string) {
  router.push({ name: "TicketAgent", params: { ticketId: name } });
}

// ── Bar chart ──────────────────────────────────────────────────────────────
const maxCount = computed(() =>
  Math.max(1, ...(data.value?.buckets.map(b => b.count) ?? [1]))
);

function barWidth(count: number): string {
  if (!count) return "0%";
  return `${Math.max(4, Math.round((count / maxCount.value) * 100))}%`;
}

function barPct(count: number): number {
  return Math.round((count / maxCount.value) * 100);
}

// ── Styles ─────────────────────────────────────────────────────────────────
const BUCKET_BAR: Record<string, string> = {
  lt_1h:   "bg-green-400",
  "1h_4h": "bg-lime-400",
  "4h_24h":"bg-amber-400",
  "1d_3d": "bg-orange-500",
  "3d_7d": "bg-red-500",
  "7d_plus":"bg-red-700",
};
const BUCKET_TEXT: Record<string, string> = {
  lt_1h:   "text-green-600",
  "1h_4h": "text-lime-600",
  "4h_24h":"text-amber-600",
  "1d_3d": "text-orange-600",
  "3d_7d": "text-red-600",
  "7d_plus":"text-red-800",
};

function bucketBarClass(key: string): string {
  return BUCKET_BAR[key] ?? "bg-blue-400";
}
function bucketTextClass(key: string): string {
  return BUCKET_TEXT[key] ?? "text-blue-600";
}

function ageClass(sec: number | null): string {
  if (sec == null) return "text-ink-gray-4";
  if (sec < 3600)   return "text-green-600";
  if (sec < 14400)  return "text-amber-600";
  if (sec < 86400)  return "text-orange-600";
  return "text-red-600";
}

function priorityClass(p: string): string {
  return ({
    Urgent: "bg-red-100 text-red-700",
    High:   "bg-orange-100 text-orange-700",
    Medium: "bg-amber-100 text-amber-700",
    Low:    "bg-green-100 text-green-700",
  } as Record<string, string>)[p] ?? "bg-surface-gray-2 text-ink-gray-5";
}

// ── Formatters ─────────────────────────────────────────────────────────────
function formatDuration(sec: number): string {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(sec / 86400);
  const h = Math.round((sec % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit",
  });
}
</script>
