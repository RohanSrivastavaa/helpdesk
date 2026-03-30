<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">Auto-Assign</span>
      </template>
      <template #right-header>
        <Button size="sm" :loading="queueLoading" @click="loadQueue">Refresh</Button>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

      <!-- ── Settings card ──────────────────────────────────────── -->
      <div class="rounded-xl border bg-surface-white p-5 flex flex-col gap-4 max-w-lg">
        <h3 class="text-sm font-semibold text-ink-gray-7">Configuration</h3>

        <!-- Enable toggle -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-ink-gray-8">Enable Auto-Assign</p>
            <p class="text-xs text-ink-gray-4 mt-0.5">Automatically assign new tickets to agents</p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            :class="config.enabled ? 'bg-blue-500' : 'bg-surface-gray-3'"
            @click="config.enabled = !config.enabled"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              :class="config.enabled ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>

        <template v-if="config.enabled">
          <!-- Strategy -->
          <div class="flex flex-col gap-2">
            <p class="text-sm font-medium text-ink-gray-8">Strategy</p>
            <div class="flex gap-3">
              <label
                v-for="opt in strategyOptions"
                :key="opt.value"
                class="flex-1 flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors"
                :class="config.strategy === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-outline-gray-2 hover:border-outline-gray-3'"
              >
                <input
                  type="radio"
                  :value="opt.value"
                  v-model="config.strategy"
                  class="mt-0.5 accent-blue-500"
                />
                <div>
                  <p class="text-sm font-medium text-ink-gray-8">{{ opt.label }}</p>
                  <p class="text-xs text-ink-gray-4 mt-0.5">{{ opt.desc }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Only online -->
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="config.only_online_agents"
              class="h-4 w-4 rounded border-outline-gray-2 accent-blue-500"
            />
            <div>
              <p class="text-sm font-medium text-ink-gray-8">Only assign to Online agents</p>
              <p class="text-xs text-ink-gray-4 mt-0.5">Skip agents who are on break, offline, or in training</p>
            </div>
          </label>
        </template>

        <Button
          variant="solid"
          :loading="saving"
          class="self-start"
          @click="save"
        >
          Save Settings
        </Button>

        <p v-if="savedMsg" class="text-xs text-green-600">✓ {{ savedMsg }}</p>
      </div>

      <!-- ── Agent queue preview ────────────────────────────────── -->
      <div class="rounded-xl border overflow-hidden bg-surface-white">
        <div class="px-4 py-3 border-b bg-surface-gray-1 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-gray-7">Agent Queue</h3>
          <span class="text-xs text-ink-gray-4">
            {{ config.strategy === 'round_robin' ? 'Sorted by last assignment (oldest first)' : 'Sorted by open ticket count (lowest first)' }}
          </span>
        </div>

        <div v-if="queueLoading" class="flex items-center justify-center h-24 text-ink-gray-4 text-sm">
          Loading…
        </div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b bg-surface-gray-1 text-xs font-semibold text-ink-gray-5 uppercase tracking-wide">
              <th class="px-4 py-2 text-left">Agent</th>
              <th class="px-4 py-2 text-center">Status</th>
              <th class="px-4 py-2 text-center">Open Tickets</th>
              <th class="px-4 py-2 text-left">Last Assigned</th>
              <th class="px-4 py-2 text-center">Eligible</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="agent in queue"
              :key="agent.user"
              class="border-b last:border-0 transition-colors"
              :class="agent.eligible ? 'hover:bg-surface-gray-1' : 'opacity-50'"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                    :style="{ backgroundColor: avatarColor(agent.user) }"
                  >
                    {{ initials(agent.full_name) }}
                  </span>
                  <div class="flex flex-col">
                    <span class="font-medium text-ink-gray-8">{{ agent.full_name }}</span>
                    <span class="text-xs text-ink-gray-4">{{ agent.user }}</span>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  :class="statusClass(agent.agent_status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full" :class="statusDot(agent.agent_status)" />
                  {{ agent.agent_status }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="font-semibold"
                  :class="agent.open_count > 10 ? 'text-red-600' : agent.open_count > 5 ? 'text-amber-600' : 'text-ink-gray-8'"
                >
                  {{ agent.open_count }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-ink-gray-5">
                {{ agent.last_assigned ? fmtDate(agent.last_assigned) : 'Never' }}
              </td>
              <td class="px-4 py-3 text-center">
                <span v-if="agent.eligible" class="text-green-500 text-base">✓</span>
                <span v-else class="text-ink-gray-3 text-base">—</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div
          v-if="!queueLoading && !queue.length"
          class="flex items-center justify-center py-12 text-ink-gray-4 text-sm"
        >
          No agents found.
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call } from "frappe-ui";
import { onMounted, reactive, ref } from "vue";

// ── Config state ───────────────────────────────────────────────────────────
const config = reactive({
  enabled: false,
  strategy: "load_balanced",
  only_online_agents: true,
});

const saving   = ref(false);
const savedMsg = ref("");

const strategyOptions = [
  {
    value: "load_balanced",
    label: "Load Balanced",
    desc: "Assign to agent with fewest open tickets",
  },
  {
    value: "round_robin",
    label: "Round Robin",
    desc: "Rotate assignments in order",
  },
];

async function loadConfig() {
  const res = await call(
    "fitelo_helpdesk.fitelo_helpdesk.api.auto_assign.get_config"
  );
  if (res) {
    config.enabled            = !!res.enabled;
    config.strategy           = res.strategy || "load_balanced";
    config.only_online_agents = !!res.only_online_agents;
  }
}

async function save() {
  saving.value = true;
  savedMsg.value = "";
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.auto_assign.save_config",
      {
        enabled:            config.enabled ? 1 : 0,
        strategy:           config.strategy,
        only_online_agents: config.only_online_agents ? 1 : 0,
      }
    );
    savedMsg.value = "Settings saved.";
    loadQueue();
    setTimeout(() => { savedMsg.value = ""; }, 3000);
  } finally {
    saving.value = false;
  }
}

// ── Agent queue ────────────────────────────────────────────────────────────
interface AgentQueueRow {
  user: string;
  full_name: string;
  agent_status: string;
  open_count: number;
  last_assigned: string | null;
  eligible: boolean;
}

const queue        = ref<AgentQueueRow[]>([]);
const queueLoading = ref(false);

async function loadQueue() {
  queueLoading.value = true;
  try {
    queue.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.auto_assign.get_agent_queue"
    ) ?? [];
  } finally {
    queueLoading.value = false;
  }
}

onMounted(() => {
  loadConfig();
  loadQueue();
});

// ── Styles & helpers ───────────────────────────────────────────────────────
function statusClass(s: string): string {
  return ({
    Online:       "bg-green-100 text-green-700",
    "On Break":   "bg-amber-100 text-amber-700",
    Lunch:        "bg-orange-100 text-orange-700",
    "In Training":"bg-blue-100 text-blue-700",
    Offline:      "bg-surface-gray-2 text-ink-gray-5",
  } as Record<string, string>)[s] ?? "bg-surface-gray-2 text-ink-gray-5";
}

function statusDot(s: string): string {
  return ({
    Online:       "bg-green-500",
    "On Break":   "bg-amber-500",
    Lunch:        "bg-orange-500",
    "In Training":"bg-blue-500",
    Offline:      "bg-ink-gray-4",
  } as Record<string, string>)[s] ?? "bg-ink-gray-4";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

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
