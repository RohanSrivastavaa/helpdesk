<template>
  <div class="flex flex-col h-full overflow-y-auto px-4 py-4 gap-4">

    <div v-if="loading" class="flex items-center justify-center h-24 text-ink-gray-4 text-sm">
      Loading…
    </div>

    <template v-else-if="data">

      <!-- ── Customer identity ────────────────────────────────────── -->
      <div class="flex items-center gap-3">
        <span
          class="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white flex-shrink-0"
          :style="{ backgroundColor: avatarColor(data.customer_email || data.whatsapp_number) }"
        >{{ initials(data.contact?.full_name || data.customer_email) }}</span>
        <div class="min-w-0">
          <p class="font-semibold text-ink-gray-9 truncate">{{ data.contact?.full_name || '—' }}</p>
          <p class="text-xs text-ink-gray-4 truncate">{{ data.customer_email }}</p>
          <p v-if="data.whatsapp_number" class="text-xs text-green-600">📱 {{ data.whatsapp_number }}</p>
        </div>
      </div>

      <!-- ── Stats row ────────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border bg-surface-white p-2 text-center">
          <p class="text-xl font-bold text-ink-gray-9">{{ data.stats.total_tickets }}</p>
          <p class="text-xs text-ink-gray-4">Tickets</p>
        </div>
        <div class="rounded-lg border bg-surface-white p-2 text-center">
          <p class="text-xl font-bold" :class="resolutionColor(data.stats.resolution_rate)">
            {{ data.stats.resolution_rate != null ? `${data.stats.resolution_rate}%` : '—' }}
          </p>
          <p class="text-xs text-ink-gray-4">Resolved</p>
        </div>
        <div class="rounded-lg border bg-surface-white p-2 text-center">
          <p class="text-xl font-bold text-amber-500">
            {{ data.stats.avg_csat_stars != null ? data.stats.avg_csat_stars.toFixed(1) : '—' }}
          </p>
          <p class="text-xs text-ink-gray-4">Avg CSAT</p>
        </div>
      </div>

      <!-- Customer since -->
      <p v-if="data.stats.first_seen" class="text-xs text-ink-gray-4">
        Customer since {{ fmtDate(data.stats.first_seen) }}
      </p>

      <!-- ── WA stats ─────────────────────────────────────────────── -->
      <div v-if="data.wa.total_messages > 0" class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        <span class="font-medium">📱 WhatsApp:</span>
        {{ data.wa.total_messages }} messages total
        <span v-if="data.wa.last_message"> · Last: {{ fmtDate(data.wa.last_message) }}</span>
      </div>

      <!-- ── Customer Notes ───────────────────────────────────────── -->
      <div>
        <p class="text-xs font-semibold text-ink-gray-5 uppercase tracking-wide mb-2">Agent Notes</p>
        <div v-if="notes.length" class="flex flex-col gap-1.5 mb-2">
          <div
            v-for="note in notes"
            :key="note.name"
            class="rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2"
          >
            <p class="text-sm text-ink-gray-8 whitespace-pre-wrap">{{ note.content }}</p>
            <div class="flex items-center justify-between mt-1">
              <span class="text-xs text-ink-gray-4">{{ note.created_by }} · {{ fmtDate(note.creation) }}</span>
              <button class="text-xs text-red-400 hover:text-red-600" @click="deleteNote(note.name)">Delete</button>
            </div>
          </div>
        </div>
        <div v-if="addingNote" class="flex flex-col gap-1.5 mt-1">
          <textarea
            v-model="noteContent"
            rows="2"
            placeholder="Note about this customer (visible across all their tickets)…"
            class="w-full resize-none rounded-lg border border-outline-gray-2 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
          <div class="flex gap-1.5">
            <button
              class="flex-1 rounded bg-blue-600 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="!noteContent.trim() || savingNote"
              @click="saveNote"
            >{{ savingNote ? 'Saving…' : 'Save Note' }}</button>
            <button class="rounded border border-outline-gray-2 px-3 py-1 text-xs text-ink-gray-6 hover:bg-surface-gray-1" @click="addingNote = false">Cancel</button>
          </div>
        </div>
        <button
          v-else
          class="text-xs text-blue-600 hover:underline mt-0.5"
          @click="addingNote = true; noteContent = ''"
        >+ Add note</button>
      </div>

      <!-- ── Recent tickets ───────────────────────────────────────── -->
      <div>
        <p class="text-xs font-semibold text-ink-gray-5 uppercase tracking-wide mb-2">Ticket History</p>
        <div v-if="data.recent_tickets.length" class="flex flex-col gap-1.5">
          <div
            v-for="t in data.recent_tickets"
            :key="t.name"
            class="rounded-lg border bg-surface-white p-2.5 cursor-pointer hover:bg-surface-gray-1 transition-colors"
            @click="openTicket(t.name)"
          >
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <span class="font-mono text-xs text-ink-gray-4">{{ t.name }}</span>
              <span
                class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                :class="statusClass(t.is_resolved)"
              >{{ t.status }}</span>
            </div>
            <p class="text-sm text-ink-gray-8 line-clamp-2">{{ t.subject }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span v-if="t.priority" class="text-xs" :class="priorityColor(t.priority)">{{ t.priority }}</span>
              <span class="text-xs text-ink-gray-4">{{ fmtDate(t.creation) }}</span>
              <span v-if="t.feedback_rating" class="text-xs text-amber-500 ml-auto">
                {{ '⭐'.repeat(Math.round(t.feedback_rating)) }}
              </span>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-ink-gray-4">No previous tickets.</p>
      </div>

    </template>

    <div v-else class="text-center py-8 text-ink-gray-4 text-sm">No customer data.</div>
  </div>
</template>

<script setup lang="ts">
import { TicketSymbol } from "@/types";
import { call, toast } from "frappe-ui";
import { inject, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const ticket = inject(TicketSymbol);
const router = useRouter();

interface Ticket360 {
  name: string; subject: string; status: string; priority: string;
  ticket_source: string; feedback_rating: number | null;
  creation: string; age_sec: number; is_resolved: boolean;
}

interface Data360 {
  customer_email: string;
  whatsapp_number: string;
  contact: { full_name: string | null; phone: string | null; email: string };
  stats: { total_tickets: number; resolved_count: number; resolution_rate: number | null;
           avg_csat_stars: number | null; first_seen: string | null };
  wa: { total_messages: number; last_message: string | null };
  recent_tickets: Ticket360[];
}

const loading = ref(false);
const data = ref<Data360 | null>(null);

// Customer notes
const notes = ref<Array<{ name: string; content: string; created_by: string; creation: string }>>([]);
const addingNote = ref(false);
const noteContent = ref("");
const savingNote = ref(false);

async function loadNotes(ticketName: string) {
  try {
    notes.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.customer_notes.get_customer_notes",
      { ticket_name: ticketName }
    ) ?? [];
  } catch { /* ignore */ }
}

async function saveNote() {
  const name = ticket?.value?.doc?.name;
  if (!name || !noteContent.value.trim() || savingNote.value) return;
  savingNote.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.customer_notes.add_customer_note", {
      ticket_name: name,
      content: noteContent.value.trim(),
    });
    noteContent.value = "";
    addingNote.value = false;
    await loadNotes(name);
  } catch {
    toast.create({ message: "Failed to save note", type: "error" });
  } finally {
    savingNote.value = false;
  }
}

async function deleteNote(noteName: string) {
  const ticketName = ticket?.value?.doc?.name;
  if (!ticketName) return;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.customer_notes.delete_customer_note", { name: noteName });
    await loadNotes(ticketName);
  } catch {
    toast.create({ message: "Failed to delete note", type: "error" });
  }
}

async function load(ticketName: string) {
  if (!ticketName) return;
  loading.value = true;
  try {
    data.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.customer_360.get_customer_360",
      { ticket_name: ticketName }
    );
    await loadNotes(ticketName);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const name = ticket?.value?.doc?.name;
  if (name) load(name);
});

watch(
  () => ticket?.value?.doc?.name,
  (n) => { if (n) load(n); }
);

function openTicket(name: string) {
  router.push({ name: "TicketAgent", params: { ticketId: name } });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusClass(isResolved: boolean): string {
  return isResolved ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
}

function priorityColor(p: string): string {
  return ({ Urgent: "text-red-600", High: "text-orange-600", Medium: "text-amber-600", Low: "text-green-600" } as Record<string,string>)[p] ?? "text-ink-gray-5";
}

function resolutionColor(rate: number | null): string {
  if (rate == null) return "text-ink-gray-4";
  if (rate >= 80) return "text-green-600";
  if (rate >= 50) return "text-amber-600";
  return "text-red-600";
}

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
function avatarColor(s: string): string {
  let hash = 0;
  for (const c of (s || "")) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}
function initials(name: string): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
</script>
