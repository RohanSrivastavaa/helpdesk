<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- Notes list -->
    <div
      ref="scrollEl"
      class="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3"
    >
      <div
        v-if="loading && !notes.length"
        class="flex items-center justify-center h-full text-ink-gray-4 text-sm"
      >
        Loading…
      </div>
      <div
        v-else-if="!notes.length"
        class="flex items-center justify-center h-full text-ink-gray-4 text-sm"
      >
        No internal notes yet.
      </div>

      <div
        v-for="note in notes"
        :key="note.name"
        class="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-yellow-800">{{ note.noted_by_full_name }}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-yellow-600">{{ formatTime(note.creation) }}</span>
            <button
              v-if="note.noted_by === authStore.userId"
              class="text-yellow-400 hover:text-red-500 transition-colors"
              title="Delete note"
              @click="deleteNote(note.name)"
            >
              ✕
            </button>
          </div>
        </div>
        <!-- Render content with @mentions highlighted -->
        <p class="text-yellow-900 whitespace-pre-wrap break-words" v-html="renderMentions(note.content)" />
      </div>
    </div>

    <!-- Composer -->
    <div class="border-t px-4 py-3 flex flex-col gap-2 bg-surface-white shrink-0 relative">
      <!-- @mention dropdown -->
      <div
        v-if="mentionDropdown.show && mentionDropdown.matches.length"
        class="absolute bottom-full left-4 mb-1 z-50 bg-white rounded-lg border shadow-lg overflow-hidden max-h-48 overflow-y-auto w-56"
      >
        <div
          v-for="(agent, idx) in mentionDropdown.matches"
          :key="agent.user"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors"
          :class="idx === mentionDropdown.selected ? 'bg-blue-50 text-blue-800' : 'text-ink-gray-8 hover:bg-surface-gray-1'"
          @mousedown.prevent="insertMention(agent)"
        >
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
            :style="{ backgroundColor: avatarColor(agent.user) }"
          >{{ initials(agent.full_name) }}</span>
          {{ agent.full_name }}
        </div>
      </div>

      <div class="flex items-end gap-2">
        <textarea
          ref="textareaEl"
          v-model="draft"
          rows="2"
          placeholder="Add an internal note… Type @ to mention an agent"
          class="flex-1 resize-none rounded-lg border border-outline-gray-2 px-3 py-2 text-sm text-ink-gray-9 focus:border-yellow-400 focus:outline-none bg-yellow-50"
          style="max-height: 120px; overflow-y: auto"
          @keydown="onKeydown"
          @input="onInput"
        />
        <Button
          variant="solid"
          :disabled="!draft.trim() || saving"
          :loading="saving"
          @click="addNote"
        >
          Save
        </Button>
      </div>
      <p class="text-xs text-ink-gray-4">
        🔒 Internal — not visible to customers · <kbd class="bg-surface-gray-2 px-1 rounded">@</kbd> to mention
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { TicketSymbol } from "@/types";
import { call } from "frappe-ui";
import { Button } from "frappe-ui";
import { inject, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { socket } from "@/socket";

const ticket = inject(TicketSymbol);
const authStore = useAuthStore();

interface InternalNote {
  name: string;
  content: string;
  noted_by: string;
  noted_by_full_name: string;
  creation: string;
}

interface Agent {
  user: string;
  full_name: string;
}

const notes = ref<InternalNote[]>([]);
const draft = ref("");
const loading = ref(false);
const saving = ref(false);
const scrollEl = ref<HTMLElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);

// ── @mention state ────────────────────────────────────────────────────────
const allAgents = ref<Agent[]>([]);
const mentionDropdown = reactive({
  show: false,
  query: "",
  matches: [] as Agent[],
  selected: 0,
  triggerPos: -1,  // cursor position where @ was typed
});

async function fetchAgents() {
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.internal_notes.get_mentionable_agents"
    );
    allAgents.value = result ?? [];
  } catch {
    // ignore
  }
}

function onInput() {
  const ta = textareaEl.value;
  if (!ta) return;
  const cursor = ta.selectionStart ?? 0;
  const text = draft.value;

  // Find last @ before cursor
  const before = text.slice(0, cursor);
  const atIdx = before.lastIndexOf("@");

  if (atIdx === -1) {
    closeMentionDropdown();
    return;
  }

  // Check there's no space between @ and cursor (unless it's a name with space)
  const fragment = before.slice(atIdx + 1);
  // Only trigger if fragment has no special chars
  if (/\s\s/.test(fragment) || fragment.includes("\n")) {
    closeMentionDropdown();
    return;
  }

  mentionDropdown.query = fragment.toLowerCase();
  mentionDropdown.triggerPos = atIdx;
  mentionDropdown.matches = allAgents.value.filter(
    a => a.full_name.toLowerCase().includes(mentionDropdown.query)
      || a.user.toLowerCase().includes(mentionDropdown.query)
  ).slice(0, 8);
  mentionDropdown.selected = 0;
  mentionDropdown.show = mentionDropdown.matches.length > 0;
}

function insertMention(agent: Agent) {
  const ta = textareaEl.value;
  if (!ta) return;
  const cursor = ta.selectionStart ?? draft.value.length;
  const text = draft.value;
  const atIdx = mentionDropdown.triggerPos;

  // Replace @query with @Full Name
  const before = text.slice(0, atIdx);
  const after  = text.slice(cursor);
  draft.value = `${before}@${agent.full_name} ${after}`;

  closeMentionDropdown();

  nextTick(() => {
    const newCursor = atIdx + agent.full_name.length + 2;
    ta.focus();
    ta.setSelectionRange(newCursor, newCursor);
  });
}

function closeMentionDropdown() {
  mentionDropdown.show = false;
  mentionDropdown.matches = [];
  mentionDropdown.query = "";
}

function onKeydown(e: KeyboardEvent) {
  if (mentionDropdown.show) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mentionDropdown.selected = Math.min(mentionDropdown.selected + 1, mentionDropdown.matches.length - 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      mentionDropdown.selected = Math.max(mentionDropdown.selected - 1, 0);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const agent = mentionDropdown.matches[mentionDropdown.selected];
      if (agent) insertMention(agent);
      return;
    }
    if (e.key === "Escape") {
      closeMentionDropdown();
      return;
    }
  }

  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addNote();
  }
}

// ── Render @mentions with blue highlight ──────────────────────────────────
function renderMentions(content: string): string {
  return content.replace(
    /@([A-Za-z][A-Za-z0-9 ]{1,40}?)(?=[^A-Za-z0-9]|$)/g,
    '<span class="inline-flex items-center bg-blue-100 text-blue-700 rounded px-1 font-medium">@$1</span>'
  );
}

// ── Notes CRUD ────────────────────────────────────────────────────────────
async function fetchNotes() {
  loading.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.internal_notes.get_internal_notes",
      { ticket_name: ticket.value.doc.name }
    );
    notes.value = result ?? [];
    await nextTick();
    scrollToBottom();
  } finally {
    loading.value = false;
  }
}

async function addNote() {
  const text = draft.value.trim();
  if (!text || saving.value) return;
  saving.value = true;
  try {
    const note = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.internal_notes.add_internal_note",
      { ticket_name: ticket.value.doc.name, content: text }
    );
    notes.value.push(note);
    draft.value = "";
    await nextTick();
    scrollToBottom();
  } finally {
    saving.value = false;
  }
}

async function deleteNote(noteName: string) {
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.internal_notes.delete_internal_note",
      { note_name: noteName }
    );
    notes.value = notes.value.filter((n) => n.name !== noteName);
  } catch {
    // ignore
  }
}

function scrollToBottom() {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function onNewNote(data: { ticket: string }) {
  if (data.ticket === ticket.value.doc.name) {
    fetchNotes();
  }
}

// ── Avatar helpers ────────────────────────────────────────────────────────
const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
function avatarColor(email: string): string {
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

onMounted(() => {
  fetchNotes();
  fetchAgents();
  socket.on("internal_note_added", onNewNote);
});

onUnmounted(() => {
  socket.off("internal_note_added", onNewNote);
});
</script>
