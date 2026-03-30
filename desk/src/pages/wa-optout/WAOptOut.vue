<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="border-b px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">WA Opt-Out Registry</h1>
        <p class="text-sm text-ink-gray-5 mt-0.5">Phone numbers that have sent STOP — no outbound messages will be sent.</p>
      </div>
      <Button variant="solid" @click="showManualDialog = true">Manual Opt-Out</Button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <!-- Search -->
      <input
        v-model="search"
        type="text"
        placeholder="Search by phone number…"
        class="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />

      <!-- Table -->
      <div class="rounded-xl border border-outline-gray-2 bg-surface-white overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-outline-gray-2 bg-surface-gray-1">
              <th class="px-4 py-2 text-left text-xs text-ink-gray-5 font-medium">Phone</th>
              <th class="px-4 py-2 text-left text-xs text-ink-gray-5 font-medium">Opted Out At</th>
              <th class="px-4 py-2 text-left text-xs text-ink-gray-5 font-medium">Reason</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Active</th>
              <th class="px-4 py-2 text-center text-xs text-ink-gray-5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filtered"
              :key="row.name"
              class="border-b border-outline-gray-2 last:border-0 hover:bg-surface-gray-1"
            >
              <td class="px-4 py-2 font-mono text-ink-gray-8">{{ row.phone_number }}</td>
              <td class="px-4 py-2 text-ink-gray-6">{{ fmtDate(row.opted_out_at) }}</td>
              <td class="px-4 py-2 text-ink-gray-6">{{ row.reason || '—' }}</td>
              <td class="px-4 py-2 text-center">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="row.is_active ? 'bg-red-100 text-red-700' : 'bg-surface-gray-2 text-ink-gray-5'"
                >
                  {{ row.is_active ? 'Opted Out' : 'Re-opted In' }}
                </span>
              </td>
              <td class="px-4 py-2 text-center">
                <button
                  v-if="row.is_active"
                  class="text-xs text-blue-600 hover:underline"
                  :disabled="actioning === row.name"
                  @click="optin(row.name, row.phone_number)"
                >
                  {{ actioning === row.name ? 'Working…' : 'Re-opt In' }}
                </button>
                <span v-else class="text-xs text-ink-gray-4">—</span>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-ink-gray-4">
                {{ loading ? 'Loading…' : 'No opt-outs found.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Manual Opt-Out Dialog -->
    <Dialog v-model="showManualDialog" :options="{ title: 'Manual Opt-Out', size: 'sm' }">
      <template #body-content>
        <div class="space-y-3 py-2">
          <div>
            <label class="block text-sm font-medium text-ink-gray-7 mb-1">Phone Number</label>
            <input
              v-model="manualPhone"
              type="text"
              placeholder="e.g. 919876543210"
              class="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink-gray-7 mb-1">Reason (optional)</label>
            <input
              v-model="manualReason"
              type="text"
              placeholder="Manually blocked by agent"
              class="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </template>
      <template #actions>
        <Button variant="ghost" @click="showManualDialog = false">Cancel</Button>
        <Button variant="solid" :loading="savingManual" :disabled="!manualPhone.trim() || savingManual" @click="doManualOptout">
          Opt Out
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Button, Dialog, call, toast } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

interface OptOutRow {
  name: string;
  phone_number: string;
  opted_out_at: string;
  reason: string;
  is_active: number;
}

const rows = ref<OptOutRow[]>([]);
const loading = ref(false);
const search = ref("");
const actioning = ref("");
const showManualDialog = ref(false);
const manualPhone = ref("");
const manualReason = ref("");
const savingManual = ref(false);

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  return rows.value.filter((r) => r.phone_number.includes(q));
});

async function load() {
  loading.value = true;
  try {
    rows.value = await call("fitelo_helpdesk.fitelo_helpdesk.api.wa_optout.get_all_optouts") ?? [];
  } finally {
    loading.value = false;
  }
}

async function optin(name: string, phone: string) {
  actioning.value = name;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.wa_optout.manual_optin", { phone });
    toast.create({ message: "Re-opted in successfully", type: "success" });
    await load();
  } catch {
    toast.create({ message: "Failed to re-opt in", type: "error" });
  } finally {
    actioning.value = "";
  }
}

async function doManualOptout() {
  savingManual.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.wa_optout.manual_optout", {
      phone: manualPhone.value.trim(),
      reason: manualReason.value.trim(),
    });
    toast.create({ message: "Opted out successfully", type: "success" });
    showManualDialog.value = false;
    manualPhone.value = "";
    manualReason.value = "";
    await load();
  } catch {
    toast.create({ message: "Failed to opt out", type: "error" });
  } finally {
    savingManual.value = false;
  }
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

onMounted(load);
</script>
