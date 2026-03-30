<template>
  <Transition name="slide-down">
    <div
      v-if="visible && suggestion"
      class="mx-5 mb-3 rounded-lg border border-amber-200 bg-amber-50 text-sm"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-amber-200">
        <div class="flex items-center gap-2">
          <span class="text-base">🤖</span>
          <span class="font-medium text-amber-800">AI Triage</span>
          <!-- Badges -->
          <span
            v-if="triageData.type"
            class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-300"
          >
            {{ triageData.type }}
          </span>
          <span
            v-if="triageData.priority"
            class="rounded-full px-2 py-0.5 text-xs font-medium border"
            :class="priorityClass"
          >
            {{ triageData.priority }}
          </span>
          <span
            v-if="triageData.sentiment"
            class="text-xs text-amber-600"
          >
            {{ sentimentEmoji }} {{ triageData.sentiment }}
          </span>
        </div>
        <button
          class="text-amber-500 hover:text-amber-700 transition-colors"
          title="Dismiss"
          @click="dismiss"
        >
          <FeatherIcon name="x" class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Summary -->
      <div v-if="triageData.summary" class="px-3 pt-2 text-xs text-amber-700 italic">
        {{ triageData.summary }}
      </div>

      <!-- Suggested reply -->
      <div class="px-3 py-2">
        <p class="text-xs font-medium text-amber-700 mb-1">Suggested reply</p>
        <p class="text-ink-gray-8 leading-relaxed">{{ suggestion }}</p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 px-3 pb-2.5">
        <button
          class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors border border-amber-300"
          @click="copyReply"
        >
          <FeatherIcon name="copy" class="h-3 w-3" />
          {{ copied ? 'Copied!' : 'Copy reply' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { TicketSymbol } from "@/types";
import { socket } from "@/socket";
import { FeatherIcon } from "frappe-ui";
import { computed, inject, onMounted, onUnmounted, ref } from "vue";

const ticket = inject(TicketSymbol);

const visible = ref(true);
const copied = ref(false);

// Live triage metadata from realtime event
const triageData = ref<{
  type?: string;
  priority?: string;
  sentiment?: string;
  summary?: string;
}>({});

const suggestion = computed(() => ticket.value?.doc?.ai_suggested_reply || "");

const priorityClass = computed(() => {
  const p = triageData.value.priority;
  if (p === "Urgent") return "bg-red-100 text-red-700 border-red-300";
  if (p === "High")   return "bg-orange-100 text-orange-700 border-orange-300";
  if (p === "Medium") return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-green-100 text-green-700 border-green-300";
});

const sentimentEmoji = computed(() => {
  const s = triageData.value.sentiment;
  if (s === "frustrated") return "😤";
  if (s === "negative")   return "😕";
  if (s === "positive")   return "😊";
  return "😐";
});

function dismiss() {
  visible.value = false;
}

async function copyReply() {
  if (!suggestion.value) return;
  await navigator.clipboard.writeText(suggestion.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function onAiTriage(data: { ticket: string; type?: string; priority?: string; sentiment?: string; summary?: string }) {
  if (data.ticket !== ticket.value?.doc?.name) return;
  triageData.value = {
    type: data.type,
    priority: data.priority,
    sentiment: data.sentiment,
    summary: data.summary,
  };
  visible.value = true;
  ticket.value.reload();
}

onMounted(() => {
  socket.on("ticket_ai_triage", onAiTriage);
  // Populate from existing data if ticket was already triaged
  if (ticket.value?.doc?.ai_suggested_reply) {
    visible.value = true;
  }
});

onUnmounted(() => {
  socket.off("ticket_ai_triage", onAiTriage);
});
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
