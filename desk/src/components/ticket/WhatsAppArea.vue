<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- Bot handling banner -->
    <div
      v-if="ticket?.value?.doc?.bot_handling"
      class="flex items-center justify-between px-4 py-2 bg-violet-50 border-b border-violet-200 shrink-0"
    >
      <div class="flex items-center gap-2 text-sm text-violet-800">
        <span class="text-base">🤖</span>
        <span class="font-medium">Bot is handling this conversation</span>
        <span class="text-xs text-violet-500">
          ({{ ticket?.value?.doc?.bot_reply_count || 0 }} auto-repl{{ (ticket?.value?.doc?.bot_reply_count || 0) === 1 ? 'y' : 'ies' }} sent)
        </span>
      </div>
      <button
        class="text-xs font-medium px-2.5 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        :disabled="takingOver"
        @click="takeover"
      >
        {{ takingOver ? 'Taking over…' : 'Take Over' }}
      </button>
    </div>

    <!-- Provider badge (Waaku backup number) -->
    <div
      v-if="ticket?.value?.doc?.ticket_source === 'Waaku WhatsApp'"
      class="flex items-center gap-2 px-4 py-1.5 bg-purple-50 border-b border-purple-200 shrink-0"
    >
      <span class="text-xs font-medium text-purple-700">📱 Waaku backup number</span>
      <span v-if="ticket?.value?.doc?.waaku_session_id" class="text-xs text-purple-500">
        ({{ ticket.value.doc.waaku_session_id }})
      </span>
    </div>

    <!-- CSAT panel (shown when ticket is resolved) -->
    <div
      v-if="isResolved && ticket?.value?.doc?.whatsapp_number"
      class="flex items-center justify-between px-4 py-2 border-b shrink-0"
      :class="csatRating ? 'bg-green-50 border-green-200' : 'bg-surface-gray-1 border-outline-gray-2'"
    >
      <div class="flex items-center gap-2 text-sm">
        <span class="text-base">{{ csatRating ? '⭐' : '📋' }}</span>
        <span v-if="csatRating" class="text-green-800 font-medium">
          CSAT received: {{ csatStars }} ({{ Math.round(csatRating * 5) }}/5)
        </span>
        <span v-else-if="ticket?.value?.doc?.csat_sent" class="text-ink-gray-6">
          CSAT sent · awaiting reply
          <span class="text-ink-gray-4 text-xs ml-1">({{ fmtCsatTime(ticket?.value?.doc?.csat_sent_at) }})</span>
        </span>
        <span v-else class="text-ink-gray-6">CSAT survey not sent yet</span>
      </div>
      <button
        v-if="!csatRating"
        class="text-xs font-medium px-2.5 py-1 rounded border transition-colors"
        :class="ticket?.value?.doc?.csat_sent
          ? 'border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2'
          : 'border-blue-400 text-blue-600 hover:bg-blue-50'"
        :disabled="sendingCsat"
        @click="sendCsat"
      >
        {{ sendingCsat ? 'Sending…' : ticket?.value?.doc?.csat_sent ? 'Resend CSAT' : 'Send CSAT' }}
      </button>
    </div>

    <!-- Message list -->
    <div
      ref="scrollEl"
      class="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2"
    >
      <div
        v-if="loading && !messages.length"
        class="flex items-center justify-center h-full text-ink-gray-4 text-sm"
      >
        Loading…
      </div>
      <div
        v-else-if="!messages.length"
        class="flex items-center justify-center h-full text-ink-gray-4 text-sm"
      >
        No WhatsApp messages yet.
      </div>

      <template v-for="msg in messages" :key="msg.name">
        <!-- Incoming: left-aligned -->
        <div
          v-if="msg.type === 'Incoming'"
          class="flex items-end gap-2 max-w-[75%] self-start"
        >
          <div class="flex flex-col gap-0.5">
            <span class="text-xs text-ink-gray-4 pl-1">
              {{ msg.profile_name || msg.from }}
            </span>
            <!-- Button-tap reply -->
            <div
              v-if="msg.content_type === 'button'"
              class="flex items-center gap-1.5 rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800"
            >
              <span class="text-base leading-none">👆</span>
              <span class="font-medium">{{ msg.message }}</span>
            </div>
            <div
              v-else
              class="rounded-2xl rounded-tl-sm bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-9 whitespace-pre-wrap break-words"
            >
              <template v-if="msg.content_type === 'image' && msg.attach">
                <a :href="msg.attach" target="_blank">
                  <img :src="msg.attach" class="max-w-[220px] rounded mb-1 cursor-pointer" />
                </a>
              </template>
              <template v-else-if="msg.content_type === 'video' && msg.attach">
                <video :src="msg.attach" controls class="max-w-[220px] rounded mb-1" />
              </template>
              <template v-else-if="msg.content_type === 'audio' && msg.attach">
                <audio :src="msg.attach" controls class="mb-1 w-full" />
              </template>
              <template v-else-if="msg.content_type === 'document' && msg.attach">
                <a :href="msg.attach" target="_blank" class="flex items-center gap-1 text-blue-600 underline text-xs mb-1">
                  📄 {{ msg.attach.split('/').pop() }}
                </a>
              </template>
              <span v-if="msg.message" class="block">{{ msg.message }}</span>
            </div>
            <span class="text-xs text-ink-gray-3 pl-1">
              {{ formatTime(msg.creation) }}
            </span>
          </div>
        </div>

        <!-- Outgoing: right-aligned -->
        <div
          v-else
          class="flex items-end gap-2 max-w-[75%] self-end"
        >
          <div class="flex flex-col gap-0.5 items-end">
            <!-- Interactive (button) message -->
            <div
              v-if="msg.content_type === 'interactive'"
              class="rounded-2xl rounded-tr-sm bg-blue-500 px-3 py-2 text-sm text-white break-words"
            >
              <p class="whitespace-pre-wrap mb-2">{{ msg.message }}</p>
              <div class="flex flex-col gap-1">
                <span
                  v-for="btn in parsedButtons(msg.buttons)"
                  :key="btn.id"
                  class="rounded-lg border border-blue-300 bg-blue-400 px-3 py-1 text-center text-xs font-medium text-white"
                >
                  {{ btn.title }}
                </span>
              </div>
            </div>
            <div
              v-else
              class="rounded-2xl rounded-tr-sm bg-blue-500 px-3 py-2 text-sm text-white whitespace-pre-wrap break-words"
            >
              <template v-if="msg.content_type === 'image' && msg.attach">
                <a :href="msg.attach" target="_blank">
                  <img :src="msg.attach" class="max-w-[220px] rounded mb-1 cursor-pointer" />
                </a>
              </template>
              <template v-else-if="msg.content_type === 'video' && msg.attach">
                <video :src="msg.attach" controls class="max-w-[220px] rounded mb-1" />
              </template>
              <template v-else-if="msg.content_type === 'audio' && msg.attach">
                <audio :src="msg.attach" controls class="mb-1 w-full" />
              </template>
              <template v-else-if="msg.content_type === 'document' && msg.attach">
                <a :href="msg.attach" target="_blank" class="flex items-center gap-1 text-blue-200 underline text-xs mb-1">
                  📄 {{ msg.attach.split('/').pop() }}
                </a>
              </template>
              <span v-if="msg.message" class="block">{{ msg.message }}</span>
            </div>
            <span class="text-xs text-ink-gray-3 pr-1 flex items-center gap-1">
              {{ formatTime(msg.creation) }}
              <span :title="msg.status" style="font-size:11px">
                <span v-if="msg.status === 'read'" style="color:#3b82f6">✓✓</span>
                <span v-else-if="msg.status === 'delivered'" style="color:#9ca3af">✓✓</span>
                <span v-else-if="msg.status === 'sent'" style="color:#9ca3af">✓</span>
                <span v-else-if="msg.status === 'failed'" style="color:#ef4444">✗</span>
              </span>
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Composer -->
    <div class="border-t px-4 py-3 flex flex-col gap-2 bg-surface-white shrink-0 relative">
      <!-- Quick Reply panel -->
      <div
        v-if="showQuickReply"
        class="absolute bottom-full left-0 right-0 border-t border-outline-gray-2 bg-surface-white shadow-lg px-4 py-3 flex flex-col gap-3 z-10"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-ink-gray-5">⚡ Quick Reply Buttons</span>
          <button class="text-ink-gray-4 hover:text-ink-gray-7 text-sm" @click="showQuickReply = false">✕</button>
        </div>
        <textarea
          v-model="qrBody"
          rows="2"
          placeholder="Message body (e.g. How would you like to proceed?)"
          class="w-full resize-none rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-ink-gray-5">Buttons (max 3, max 20 chars each)</span>
          <div
            v-for="(btn, i) in qrButtons"
            :key="i"
            class="flex items-center gap-2"
          >
            <input
              v-model="qrButtons[i]"
              type="text"
              :maxlength="20"
              :placeholder="`Button ${i + 1} label`"
              class="flex-1 rounded border border-outline-gray-2 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              @keydown.enter.prevent="sendQuickReply"
            />
            <button
              v-if="qrButtons.length > 1"
              class="text-ink-gray-3 hover:text-red-500 text-sm"
              @click="qrButtons.splice(i, 1)"
            >✕</button>
          </div>
          <button
            v-if="qrButtons.length < 3"
            class="self-start text-xs text-blue-600 hover:underline"
            @click="qrButtons.push('')"
          >
            + Add button
          </button>
        </div>
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded border border-outline-gray-2 px-3 py-1.5 text-xs text-ink-gray-6 hover:bg-surface-gray-1"
            @click="showQuickReply = false"
          >
            Cancel
          </button>
          <button
            class="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="!qrBody.trim() || !qrButtons.some(b => b.trim()) || sendingQr"
            @click="sendQuickReply"
          >
            {{ sendingQr ? 'Sending…' : 'Send Buttons' }}
          </button>
        </div>
      </div>

      <!-- Canned response dropdown -->
      <div
        v-if="showSuggestions && filteredReplies.length"
        class="absolute bottom-full left-4 right-4 mb-1 bg-white border border-outline-gray-2 rounded-lg shadow-lg max-h-52 overflow-y-auto z-10"
      >
        <div class="px-3 py-1.5 text-xs text-ink-gray-4 border-b">
          Saved Replies — <kbd class="bg-surface-gray-2 px-1 rounded text-xs">↑↓</kbd> navigate &nbsp;
          <kbd class="bg-surface-gray-2 px-1 rounded text-xs">Enter</kbd> select &nbsp;
          <kbd class="bg-surface-gray-2 px-1 rounded text-xs">Esc</kbd> close
        </div>
        <div
          v-for="(reply, idx) in filteredReplies"
          :key="reply.name"
          class="px-3 py-2 cursor-pointer hover:bg-surface-gray-1 flex flex-col gap-0.5"
          :class="{ 'bg-surface-gray-1': idx === activeIdx }"
          @mousedown.prevent="selectReply(reply)"
        >
          <span class="text-sm font-medium text-ink-gray-9">{{ reply.title }}</span>
          <span class="text-xs text-ink-gray-4 truncate">{{ reply.preview }}</span>
        </div>
      </div>

      <!-- AI draft strip -->
      <div
        v-if="aiDraft && !aiDraftDismissed"
        class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs"
      >
        <span class="text-base leading-none mt-0.5">🤖</span>
        <div class="flex-1 min-w-0">
          <span class="font-medium text-amber-800">AI Draft · </span>
          <span class="text-amber-700 line-clamp-2">{{ aiDraft }}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            class="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors"
            @click="useAiDraft"
          >
            Use
          </button>
          <button
            class="px-2 py-0.5 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            :disabled="sending"
            @click="sendAiDraft"
          >
            Send Now
          </button>
          <button
            class="text-amber-400 hover:text-amber-600 transition-colors ml-1"
            title="Dismiss"
            @click="aiDraftDismissed = true"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Media preview strip -->
      <div
        v-if="pendingMedia"
        class="flex items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2"
      >
        <span class="text-xl leading-none">
          {{ pendingMedia.content_type === 'image' ? '🖼️' : pendingMedia.content_type === 'video' ? '🎬' : pendingMedia.content_type === 'audio' ? '🎵' : '📄' }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink-gray-8">{{ pendingMedia.file_name }}</p>
          <p class="text-xs text-ink-gray-4 capitalize">{{ pendingMedia.content_type }}</p>
        </div>
        <img
          v-if="pendingMedia.content_type === 'image'"
          :src="pendingMedia.file_url"
          class="h-12 w-12 rounded object-cover border border-outline-gray-2"
        />
        <button class="text-ink-gray-3 hover:text-red-500 shrink-0" @click="clearMedia">✕</button>
      </div>

      <div class="flex items-end gap-2">
        <textarea
          ref="textareaEl"
          v-model="draft"
          rows="1"
          :placeholder="pendingMedia ? 'Add a caption (optional)…' : 'Type / for saved replies…'"
          class="flex-1 resize-none rounded-lg border border-outline-gray-2 px-3 py-2 text-sm text-ink-gray-9 focus:border-outline-gray-4 focus:outline-none bg-surface-white"
          style="max-height: 120px; overflow-y: auto"
          @input="onInput"
          @keydown="onKeydown"
        />
        <!-- File uploader -->
        <FileUploader
          :upload-args="{ folder: 'Home/Helpdesk', private: false }"
          @success="onFileUploaded"
          @failure="() => toast.create({ message: 'Upload failed', type: 'error' })"
        >
          <template #default="{ openFileSelector }">
            <button
              class="shrink-0 rounded-lg border border-outline-gray-2 px-2.5 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-1 transition-colors"
              :class="{ 'border-blue-300 bg-blue-50 text-blue-600': pendingMedia }"
              title="Attach image / document / video / audio"
              @click="openFileSelector()"
            >
              📎
            </button>
          </template>
        </FileUploader>
        <button
          class="shrink-0 rounded-lg border border-outline-gray-2 px-2.5 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-1 transition-colors"
          :class="{ 'bg-blue-50 border-blue-300 text-blue-600': showQuickReply }"
          title="Send quick reply buttons"
          @click="toggleQuickReply"
        >
          ⚡
        </button>
        <!-- AI reply button -->
        <button
          class="shrink-0 rounded-lg border border-outline-gray-2 px-2.5 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-1 transition-colors"
          :class="{ 'bg-purple-50 border-purple-300 text-purple-700': generatingAi }"
          title="Generate AI reply"
          :disabled="generatingAi"
          @click="generateAiReply"
        >{{ generatingAi ? '⏳' : '✨' }}</button>
        <!-- Schedule button -->
        <button
          class="shrink-0 rounded-lg border border-outline-gray-2 px-2.5 py-2 text-sm text-ink-gray-6 hover:bg-surface-gray-1 transition-colors"
          :class="{ 'bg-amber-50 border-amber-300 text-amber-700': showSchedule }"
          title="Schedule message"
          @click="toggleSchedule"
        >
          🕐
        </button>
        <!-- If media pending, show Send Media; otherwise normal Send -->
        <Button
          v-if="pendingMedia"
          variant="solid"
          :loading="sendingMedia"
          :disabled="sendingMedia"
          @click="sendMedia"
        >
          Send
        </Button>
        <Button
          v-else
          variant="solid"
          :disabled="!draft.trim() || sending"
          :loading="sending"
          @click="send"
        >
          Send
        </Button>
      </div>

      <!-- Schedule panel -->
      <div
        v-if="showSchedule"
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-amber-700">🕐 Schedule Message</span>
          <button class="text-amber-400 hover:text-amber-600 text-sm" @click="showSchedule = false">✕</button>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="scheduleAt"
            type="datetime-local"
            class="flex-1 rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
          />
          <button
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            :disabled="!draft.trim() || !scheduleAt || scheduling"
            @click="scheduleMessage"
          >
            {{ scheduling ? 'Scheduling…' : 'Schedule' }}
          </button>
        </div>
        <!-- Pending scheduled messages -->
        <div v-if="scheduledMessages.length" class="space-y-1.5">
          <p class="text-xs text-amber-700 font-medium">Pending scheduled messages</p>
          <div
            v-for="sm in scheduledMessages"
            :key="sm.name"
            class="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
          >
            <div class="flex-1 min-w-0">
              <p class="text-xs text-ink-gray-8 truncate">{{ sm.message }}</p>
              <p class="text-xs text-amber-600 mt-0.5">{{ fmtScheduled(sm.scheduled_at) }} · {{ sm.status }}</p>
            </div>
            <button
              v-if="sm.status === 'Pending'"
              class="text-xs text-red-500 hover:underline shrink-0"
              @click="cancelScheduled(sm.name)"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { socket } from "@/socket";
import { TicketSymbol } from "@/types";
import { Button, FileUploader, call, toast } from "frappe-ui";
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from "vue";

const ticket = inject(TicketSymbol);

interface WaMessage {
  name: string;
  type: "Incoming" | "Outgoing";
  from: string;
  to: string;
  message: string;
  content_type: string;
  buttons?: string;
  status: string;
  creation: string;
  attach: string;
  profile_name: string;
  message_id: string;
}

interface QrButton {
  id: string;
  title: string;
}

interface SavedReply {
  name: string;
  title: string;
  message: string;
  preview: string;
}

const messages = ref<WaMessage[]>([]);
const draft = ref("");
const loading = ref(false);
const sending = ref(false);
const takingOver = ref(false);
const aiDraftDismissed = ref(false);
const scrollEl = ref<HTMLElement | null>(null);
const textareaEl = ref<HTMLTextAreaElement | null>(null);

// Quick Reply
const showQuickReply = ref(false);
const qrBody = ref("");
const qrButtons = ref<string[]>(["", ""]);
const sendingQr = ref(false);

// AI reply generation
const generatingAi = ref(false);

async function generateAiReply() {
  if (generatingAi.value) return;
  generatingAi.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.ai_reply.generate_reply",
      { ticket_name: ticket?.value?.doc?.name }
    );
    if (result?.reply) {
      draft.value = result.reply;
      await nextTick();
      textareaEl.value?.focus();
    }
  } catch {
    toast.create({ message: "AI reply generation failed", type: "error" });
  } finally {
    generatingAi.value = false;
  }
}

// Schedule
const showSchedule = ref(false);
const scheduleAt = ref("");
const scheduling = ref(false);
const scheduledMessages = ref<Array<{ name: string; message: string; scheduled_at: string; status: string }>>([]);

function toggleSchedule() {
  showSchedule.value = !showSchedule.value;
  if (showSchedule.value) fetchScheduledMessages();
}

async function fetchScheduledMessages() {
  try {
    scheduledMessages.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.wa_schedule.get_scheduled_messages",
      { ticket_name: ticket?.value?.doc?.name }
    ) ?? [];
  } catch { /* ignore */ }
}

async function scheduleMessage() {
  const text = draft.value.trim();
  if (!text || !scheduleAt.value || scheduling.value) return;
  scheduling.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.wa_schedule.schedule_message", {
      ticket_name: ticket?.value?.doc?.name,
      message: text,
      scheduled_at: scheduleAt.value,
    });
    draft.value = "";
    scheduleAt.value = "";
    toast.create({ message: "Message scheduled", type: "success" });
    await fetchScheduledMessages();
  } catch {
    toast.create({ message: "Failed to schedule message", type: "error" });
  } finally {
    scheduling.value = false;
  }
}

async function cancelScheduled(name: string) {
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.wa_schedule.cancel_scheduled_message", { name });
    toast.create({ message: "Scheduled message cancelled", type: "success" });
    await fetchScheduledMessages();
  } catch {
    toast.create({ message: "Failed to cancel", type: "error" });
  }
}

function fmtScheduled(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Media attachment
interface PendingMedia {
  file_url: string;
  file_name: string;
  content_type: "image" | "document" | "video" | "audio";
}
const pendingMedia = ref<PendingMedia | null>(null);
const sendingMedia = ref(false);

const aiDraft = computed(() => ticket.value?.doc?.ai_suggested_reply || "");

// CSAT
const sendingCsat = ref(false);
const RESOLVED_STATUSES = ["Resolved", "Closed"];
const isResolved  = computed(() => RESOLVED_STATUSES.includes(ticket.value?.doc?.status));
const csatRating  = computed(() => ticket.value?.doc?.feedback_rating || 0);
const csatStars   = computed(() => {
  const n = Math.round((csatRating.value || 0) * 5);
  return "⭐".repeat(n);
});

// Canned responses
const savedReplies = ref<SavedReply[]>([]);
const showSuggestions = ref(false);
const activeIdx = ref(0);

const filteredReplies = computed(() => {
  if (!draft.value.startsWith("/")) return [];
  const query = draft.value.slice(1).toLowerCase();
  return savedReplies.value.filter(
    (r) =>
      !query ||
      r.title.toLowerCase().includes(query) ||
      r.preview.toLowerCase().includes(query)
  );
});

function mediaContentType(fileName: string): PendingMedia["content_type"] {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "ogg", "opus", "m4a", "wav", "aac"].includes(ext)) return "audio";
  return "document";
}

function onFileUploaded(file: { file_url: string; file_name: string }) {
  pendingMedia.value = {
    file_url: file.file_url,
    file_name: file.file_name,
    content_type: mediaContentType(file.file_name),
  };
}

function clearMedia() {
  pendingMedia.value = null;
}

async function sendMedia() {
  const media = pendingMedia.value;
  if (!media || sendingMedia.value) return;
  sendingMedia.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.send_whatsapp_media",
      {
        ticket_name: ticket?.value?.doc?.name,
        file_url: media.file_url,
        media_content_type: media.content_type,
        caption: draft.value.trim(),
      }
    );
    pendingMedia.value = null;
    draft.value = "";
    await fetchMessages();
  } catch {
    toast.create({ message: "Failed to send media", type: "error" });
  } finally {
    sendingMedia.value = false;
  }
}

function parsedButtons(raw: string | undefined): QrButton[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toggleQuickReply() {
  showQuickReply.value = !showQuickReply.value;
  if (showQuickReply.value) {
    qrBody.value = "";
    qrButtons.value = ["", ""];
  }
}

async function sendQuickReply() {
  const body = qrBody.value.trim();
  const buttons = qrButtons.value
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((title) => ({ id: title, title }));

  if (!body || buttons.length === 0 || sendingQr.value) return;
  sendingQr.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.send_quick_reply",
      {
        ticket_name: ticket?.value?.doc?.name,
        body_text: body,
        buttons: JSON.stringify(buttons),
      }
    );
    showQuickReply.value = false;
    await fetchMessages();
  } finally {
    sendingQr.value = false;
  }
}

async function fetchSavedReplies() {
  const result = await call("frappe.client.get_list", {
    doctype: "HD Saved Reply",
    fields: ["name", "title", "message"],
    limit: 100,
  });
  savedReplies.value = (result ?? []).map((r: any) => ({
    ...r,
    preview: stripHtml(r.message).slice(0, 80),
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function onInput(e: Event) {
  autoResize(e);
  showSuggestions.value = draft.value.startsWith("/");
  activeIdx.value = 0;
}

function onKeydown(e: KeyboardEvent) {
  if (!showSuggestions.value || !filteredReplies.value.length) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIdx.value = (activeIdx.value + 1) % filteredReplies.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIdx.value =
      (activeIdx.value - 1 + filteredReplies.value.length) %
      filteredReplies.value.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    selectReply(filteredReplies.value[activeIdx.value]);
  } else if (e.key === "Escape") {
    showSuggestions.value = false;
  }
}

function selectReply(reply: SavedReply) {
  draft.value = stripHtml(reply.message);
  showSuggestions.value = false;
  nextTick(() => {
    if (textareaEl.value) {
      textareaEl.value.style.height = "auto";
      textareaEl.value.style.height = `${Math.min(textareaEl.value.scrollHeight, 120)}px`;
      textareaEl.value.focus();
    }
  });
}

async function sendCsat() {
  sendingCsat.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.send_csat_survey",
      { ticket_name: ticket?.value?.doc?.name }
    );
    ticket?.value?.reload();
    await fetchMessages();
  } finally {
    sendingCsat.value = false;
  }
}

function fmtCsatTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function takeover() {
  takingOver.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.bot_takeover",
      { ticket_name: ticket?.value?.doc?.name }
    );
    ticket?.value?.reload();
  } finally {
    takingOver.value = false;
  }
}

function useAiDraft() {
  draft.value = aiDraft.value;
  aiDraftDismissed.value = true;
  nextTick(() => textareaEl.value?.focus());
}

async function sendAiDraft() {
  if (!aiDraft.value || sending.value) return;
  draft.value = aiDraft.value;
  aiDraftDismissed.value = true;
  await send();
}

async function fetchMessages() {
  loading.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.get_whatsapp_messages",
      { ticket_name: ticket?.value?.doc?.name }
    );
    messages.value = result ?? [];
    await nextTick();
    scrollToBottom();
  } finally {
    loading.value = false;
  }
}

async function send() {
  const text = draft.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.send_whatsapp_message",
      { ticket_name: ticket?.value?.doc?.name, message: text }
    );
    draft.value = "";
    showSuggestions.value = false;
    await fetchMessages();
  } finally {
    sending.value = false;
  }
}

function scrollToBottom() {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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

function onNewMessage(data: { ticket: string }) {
  if (data.ticket === ticket?.value?.doc?.name) {
    fetchMessages();
  }
}

function onBotUpdate(data: { ticket: string; bot_handling: number }) {
  if (data.ticket === ticket?.value?.doc?.name) {
    ticket?.value?.reload();
  }
}

function onCsatUpdate(data: { ticket: string }) {
  if (data.ticket === ticket?.value?.doc?.name) {
    ticket?.value?.reload();
    fetchMessages();
  }
}

// Poll for status updates (sent → delivered → read) every 8s while tab is open
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

function startStatusPoll() {
  statusPollTimer = setInterval(() => {
    const hasPending = messages.value.some(
      (m) => m.type === "Outgoing" && ["sent", "delivered"].includes(m.status)
    );
    if (hasPending) fetchMessages();
  }, 8000);
}

onMounted(() => {
  fetchMessages();
  fetchSavedReplies();
  startStatusPoll();
  socket.on("whatsapp_message", onNewMessage);
  socket.on("bot_handling_update", onBotUpdate);
  socket.on("csat_update", onCsatUpdate);
});

onUnmounted(() => {
  if (statusPollTimer) clearInterval(statusPollTimer);
  socket.off("whatsapp_message", onNewMessage);
  socket.off("bot_handling_update", onBotUpdate);
  socket.off("csat_update", onCsatUpdate);
});
</script>
