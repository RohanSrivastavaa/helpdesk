<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-white">
    <!-- Header -->
    <div class="flex items-center justify-between border-b px-6 py-4">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">WhatsApp Broadcast</h1>
        <p class="mt-0.5 text-sm text-ink-gray-5">Send a message to multiple WA contacts at once</p>
      </div>
    </div>

    <div class="flex flex-1 gap-0 overflow-hidden">
      <!-- LEFT: Recipient picker -->
      <div class="flex w-80 shrink-0 flex-col border-r">
        <div class="space-y-3 border-b p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Filter contacts</p>

          <!-- Status filter -->
          <div>
            <label class="mb-1 block text-xs text-ink-gray-6">Ticket Status</label>
            <select
              v-model="filterStatus"
              class="w-full rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              @change="fetchRecipients"
            >
              <option value="">All tickets</option>
              <option value="open">Open tickets only</option>
              <option value="resolved">Resolved tickets only</option>
            </select>
          </div>

          <!-- Search filter -->
          <div>
            <label class="mb-1 block text-xs text-ink-gray-6">Search name / number</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="e.g. Rahul or 919876..."
              class="w-full rounded border border-outline-gray-2 bg-surface-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <!-- Select all -->
          <div class="flex items-center justify-between">
            <span class="text-xs text-ink-gray-5">{{ filteredRecipients.length }} contacts</span>
            <button
              class="text-xs text-blue-600 hover:underline"
              @click="toggleSelectAll"
            >
              {{ allSelected ? "Deselect all" : "Select all" }}
            </button>
          </div>
        </div>

        <!-- Recipient list -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="loadingRecipients" class="flex items-center justify-center py-8">
            <span class="text-sm text-ink-gray-5">Loading…</span>
          </div>
          <div
            v-for="r in filteredRecipients"
            :key="r.phone"
            class="flex cursor-pointer items-center gap-3 border-b px-4 py-3 hover:bg-surface-gray-1"
            :class="{ 'bg-blue-50': selected.has(r.phone) }"
            @click="toggleRecipient(r.phone)"
          >
            <input
              type="checkbox"
              :checked="selected.has(r.phone)"
              class="h-3.5 w-3.5 accent-blue-600"
              @click.stop="toggleRecipient(r.phone)"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink-gray-9">{{ r.name || r.phone }}</p>
              <p class="truncate text-xs text-ink-gray-5">+{{ r.phone }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-1.5 py-0.5 text-xs"
              :class="statusClass(r.status)"
            >{{ r.status }}</span>
          </div>
          <div v-if="!loadingRecipients && filteredRecipients.length === 0" class="py-8 text-center text-sm text-ink-gray-5">
            No contacts found
          </div>
        </div>

        <!-- Manual add -->
        <div class="border-t p-4">
          <p class="mb-2 text-xs font-medium text-ink-gray-5">Add number manually</p>
          <div class="flex gap-2">
            <input
              v-model="manualNumber"
              type="text"
              placeholder="91XXXXXXXXXX"
              class="min-w-0 flex-1 rounded border border-outline-gray-2 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              @keydown.enter="addManual"
            />
            <button
              class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              @click="addManual"
            >Add</button>
          </div>
        </div>
      </div>

      <!-- RIGHT: Message composer + send -->
      <div class="flex flex-1 flex-col">
        <!-- Selected badge strip -->
        <div class="flex items-center gap-2 border-b bg-surface-gray-1 px-6 py-3">
          <span class="text-sm text-ink-gray-6">
            <span class="font-semibold text-ink-gray-9">{{ selected.size }}</span>
            recipient{{ selected.size !== 1 ? "s" : "" }} selected
          </span>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="phone in [...selected].slice(0, 8)"
              :key="phone"
              class="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
            >
              +{{ phone }}
              <button class="ml-0.5 text-blue-400 hover:text-blue-700" @click="selected.delete(phone)">×</button>
            </span>
            <span v-if="selected.size > 8" class="rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-5">
              +{{ selected.size - 8 }} more
            </span>
          </div>
        </div>

        <!-- Composer -->
        <div class="flex-1 overflow-y-auto p-6">
          <label class="mb-2 block text-sm font-medium text-ink-gray-7">Message</label>
          <textarea
            v-model="message"
            rows="8"
            placeholder="Type your broadcast message here…"
            class="w-full rounded border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p class="mt-1 text-right text-xs text-ink-gray-5">{{ message.length }} chars</p>

          <!-- Preview -->
          <div v-if="message.trim()" class="mt-6">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">Preview</p>
            <div class="inline-block max-w-xs rounded-2xl rounded-tl-none bg-surface-gray-2 px-4 py-3 text-sm text-ink-gray-9 shadow-sm">
              <p class="whitespace-pre-wrap">{{ message }}</p>
            </div>
          </div>
        </div>

        <!-- Send bar -->
        <div class="flex items-center justify-between border-t px-6 py-4">
          <div v-if="result" class="text-sm">
            <span class="text-green-700">✓ {{ result.sent.length }} sent</span>
            <span v-if="result.failed.length" class="ml-3 text-red-600">✗ {{ result.failed.length }} failed</span>
          </div>
          <div v-else class="text-sm text-ink-gray-5">
            Messages will be sent individually via WhatsApp
          </div>

          <button
            class="flex items-center gap-2 rounded bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canSend || sending"
            @click="sendBroadcast"
          >
            <span v-if="sending">Sending {{ sendProgress }}/{{ selected.size }}…</span>
            <span v-else>Send to {{ selected.size }} contact{{ selected.size !== 1 ? "s" : "" }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call, toast } from "frappe-ui";
import { computed, onMounted, ref } from "vue";

interface Recipient {
  phone: string;
  name: string;
  ticket?: string;
  subject?: string;
  status?: string;
}

const loadingRecipients = ref(false);
const allRecipients = ref<Recipient[]>([]);
const selected = ref<Set<string>>(new Set());
const filterStatus = ref("");
const searchQuery = ref("");
const message = ref("");
const sending = ref(false);
const sendProgress = ref(0);
const result = ref<{ sent: string[]; failed: string[] } | null>(null);
const manualNumber = ref("");

const filteredRecipients = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allRecipients.value;
  return allRecipients.value.filter(
    (r) =>
      r.phone.includes(q) ||
      (r.name || "").toLowerCase().includes(q) ||
      (r.subject || "").toLowerCase().includes(q)
  );
});

const allSelected = computed(
  () =>
    filteredRecipients.value.length > 0 &&
    filteredRecipients.value.every((r) => selected.value.has(r.phone))
);

const canSend = computed(() => selected.value.size > 0 && message.value.trim().length > 0);

async function fetchRecipients() {
  loadingRecipients.value = true;
  try {
    const data = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.broadcast.get_broadcast_recipients",
      { ticket_status: filterStatus.value }
    );
    allRecipients.value = data || [];
  } catch {
    toast.create({ message: "Failed to load recipients", type: "error" });
  } finally {
    loadingRecipients.value = false;
  }
}

function toggleRecipient(phone: string) {
  if (selected.value.has(phone)) {
    selected.value.delete(phone);
  } else {
    selected.value.add(phone);
  }
  // trigger reactivity
  selected.value = new Set(selected.value);
}

function toggleSelectAll() {
  if (allSelected.value) {
    filteredRecipients.value.forEach((r) => selected.value.delete(r.phone));
  } else {
    filteredRecipients.value.forEach((r) => selected.value.add(r.phone));
  }
  selected.value = new Set(selected.value);
}

function addManual() {
  const num = manualNumber.value.trim().replace(/^\+/, "");
  if (!num) return;
  if (!allRecipients.value.find((r) => r.phone === num)) {
    allRecipients.value.unshift({ phone: num, name: num });
  }
  selected.value.add(num);
  selected.value = new Set(selected.value);
  manualNumber.value = "";
}

async function sendBroadcast() {
  if (!canSend.value || sending.value) return;

  const confirmed = window.confirm(
    `Send "${message.value.slice(0, 60)}${message.value.length > 60 ? "…" : ""}" to ${selected.value.size} contact${selected.value.size !== 1 ? "s" : ""}?`
  );
  if (!confirmed) return;

  sending.value = true;
  sendProgress.value = 0;
  result.value = null;

  // Build recipient list with ticket links
  const phoneToMeta = Object.fromEntries(
    allRecipients.value.map((r) => [r.phone, r])
  );
  const recipients = [...selected.value].map((phone) => ({
    phone,
    name: phoneToMeta[phone]?.name || phone,
    ticket: phoneToMeta[phone]?.ticket || null,
  }));

  try {
    const res = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.broadcast.send_broadcast",
      { recipients: JSON.stringify(recipients), message: message.value }
    );
    result.value = res;
    sendProgress.value = res.sent.length + res.failed.length;

    if (res.failed.length === 0) {
      toast.create({ message: `Broadcast sent to ${res.sent.length} contacts`, type: "success" });
    } else {
      toast.create({
        message: `Sent: ${res.sent.length}, Failed: ${res.failed.length}`,
        type: "warning",
      });
    }
  } catch {
    toast.create({ message: "Broadcast failed", type: "error" });
  } finally {
    sending.value = false;
  }
}

function statusClass(status: string | undefined) {
  if (!status) return "bg-surface-gray-2 text-ink-gray-5";
  const s = status.toLowerCase();
  if (s === "open") return "bg-blue-100 text-blue-700";
  if (s === "resolved" || s === "closed") return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-700";
}

onMounted(() => {
  fetchRecipients();
});
</script>
