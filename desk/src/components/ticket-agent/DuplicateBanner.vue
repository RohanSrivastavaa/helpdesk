<template>
  <div
    v-if="duplicates.length && !dismissed"
    class="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5 shrink-0"
  >
    <span class="mt-0.5 text-sm leading-none">⚠️</span>
    <div class="flex-1 min-w-0">
      <span class="text-xs font-semibold text-amber-800">Possible duplicate — </span>
      <span class="text-xs text-amber-700">similar open ticket{{ duplicates.length > 1 ? 's' : '' }}:</span>
      <span class="ml-1 text-xs text-amber-700">
        <span v-for="(d, i) in duplicates" :key="d.name">
          <button
            class="font-mono font-semibold text-blue-600 hover:underline"
            @click="openTicket(d.name)"
          >#{{ d.name }}</button>
          <span class="text-amber-500"> {{ d.subject }}</span>
          <span v-if="i < duplicates.length - 1">, </span>
        </span>
      </span>
    </div>
    <button
      class="shrink-0 text-xs text-amber-400 hover:text-amber-700"
      title="Dismiss"
      @click="dismissed = true"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { call } from "frappe-ui";
import { inject, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { TicketSymbol } from "@/types";

const ticket = inject(TicketSymbol);
const router = useRouter();

const duplicates = ref<{ name: string; subject: string }[]>([]);
const dismissed = ref(false);

async function fetchDuplicates() {
  const subject = ticket.value?.doc?.subject;
  const name = ticket.value?.doc?.name;
  if (!subject || subject.length < 5) return;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.duplicate_detection.find_open_duplicates",
      { subject, exclude_ticket: name }
    );
    duplicates.value = result || [];
  } catch {
    duplicates.value = [];
  }
}

// Re-check if subject changes
watch(() => ticket.value?.doc?.subject, (val, old) => {
  if (val !== old) {
    dismissed.value = false;
    fetchDuplicates();
  }
});

function openTicket(ticketId: string) {
  router.push({ name: "TicketAgent", params: { ticketId } });
}

onMounted(() => {
  fetchDuplicates();
});
</script>
