<template>
  <div v-if="ticket.doc?.name" class="flex-1 flex flex-col overflow-hidden">
    <TicketHeader :viewers="viewers" />

    <!-- Handoff banner -->
    <div
      v-if="pendingHandoff"
      class="flex items-start gap-3 border-b border-blue-200 bg-blue-50 px-5 py-3 shrink-0"
    >
      <span class="mt-0.5 text-xl leading-none">🤝</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-blue-900">
          Handoff note from {{ pendingHandoff.from_name }}
        </p>
        <p class="mt-0.5 whitespace-pre-wrap text-sm text-blue-800">{{ pendingHandoff.content }}</p>
        <p class="mt-1 text-xs text-blue-500">{{ fmtHandoffTime(pendingHandoff.creation) }}</p>
      </div>
      <button
        class="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        @click="dismissHandoff"
      >
        Got it
      </button>
    </div>

    <!-- Duplicate detection banner removed -->

    <div class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Tabs & Communication Area -->
        <TicketActivityPanel />
      </div>

      <!-- Sidepanel with Resizer -->
      <TicketSidebar />
    </div>
    <SetContactPhoneModal
      v-model="showPhoneModal"
      :name="ticket.data?.contact?.name"
      @onUpdate="ticket.reload"
    />
  </div>
</template>

<script setup lang="ts">
import TicketActivityPanel from "@/components/ticket-agent/TicketActivityPanel.vue";
import TicketHeader from "@/components/ticket-agent/TicketHeader.vue";
import TicketSidebar from "@/components/ticket-agent/TicketSidebar.vue";
import SetContactPhoneModal from "@/components/ticket/SetContactPhoneModal.vue";
import { socket } from "@/socket";
import { useActiveViewers } from "@/composables/realtime";
import { reloadTicket, useTicket } from "@/composables/useTicket";
import { ticketsToNavigate } from "@/composables/useTicketNavigation";
import { globalStore } from "@/stores/globalStore";
import { useTelephonyStore } from "@/stores/telephony";
import {
  ActivitiesSymbol,
  AssigneeSymbol,
  Customizations,
  CustomizationSymbol,
  RecentSimilarTicketsSymbol,
  Resource,
  TicketContactSymbol,
  TicketSymbol,
} from "@/types";
import { call, createResource, toast, usePageMeta } from "frappe-ui";
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { showCommentBox, showEmailBox } from "./modalStates";
const telephonyStore = useTelephonyStore();

const { $socket } = globalStore();

const props = defineProps({
  ticketId: {
    type: String,
    required: true,
  },
});
const route = useRoute();
const showPhoneModal = ref(false);

// Handoff note banner
interface HandoffNote {
  name: string;
  content: string;
  from_name: string;
  creation: string;
}
const pendingHandoff = ref<HandoffNote | null>(null);

async function fetchHandoff() {
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.handoff.get_pending_handoff",
      { ticket_name: props.ticketId }
    );
    pendingHandoff.value = result || null;
  } catch {
    // ignore
  }
}

async function dismissHandoff() {
  if (!pendingHandoff.value) return;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.handoff.dismiss_handoff", {
      note_name: pendingHandoff.value.name,
    });
    pendingHandoff.value = null;
  } catch {
    toast.create({ message: "Failed to dismiss", type: "error" });
  }
}

function fmtHandoffTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function onHandoffNote(data: { ticket: string }) {
  if (data.ticket === props.ticketId) {
    fetchHandoff();
  }
}

function onTicketReopened(data: { ticket: string; status: string }) {
  if (data.ticket === props.ticketId) {
    reloadTicket(props.ticketId);
    toast.create({
      message: `Ticket reopened — customer sent a new WhatsApp message (status: ${data.status})`,
      type: "info",
    });
  }
}

const ticketComposable = computed(() => useTicket(props.ticketId));
const ticket = computed(() => ticketComposable.value.ticket);
const customizations: Resource<Customizations> = createResource({
  url: "helpdesk.helpdesk.doctype.hd_ticket.api.get_ticket_customizations",
  cache: ["HD Ticket", "customizations"],
  auto: true,
});

provide(TicketSymbol, ticket);

provide(
  AssigneeSymbol,
  computed(() => ticketComposable.value.assignees)
);
provide(
  TicketContactSymbol,
  computed(() => ticketComposable.value.contact)
);
provide(
  CustomizationSymbol,
  computed(() => customizations)
);
provide(
  RecentSimilarTicketsSymbol,
  computed(() => ticketComposable.value.recentSimilarTickets)
);
provide(
  ActivitiesSymbol,
  computed(() => ticketComposable.value.activities)
);
provide("makeCall", () => {
  if (
    !ticketComposable.value.contact.data?.mobile_no &&
    !ticketComposable.value.contact.data?.phone
  ) {
    showPhoneModal.value = true;
    return;
  }
  telephonyStore.makeCall({
    number:
      ticketComposable.value.contact.data?.phone ||
      ticketComposable.value.contact.data?.mobile_no,
    doctype: "HD Ticket",
    docname: props.ticketId,
  });
});
const viewerComposable = computed(() => useActiveViewers(ticket.value.name));
const viewers = computed(
  () => viewerComposable.value.currentViewers[props.ticketId] || []
);
const { startViewing, stopViewing } = viewerComposable.value;

// handling for faster navigation between tickets
watch(
  () => route.params.ticketId,
  (newTicketId, oldTicketId) => {
    if (newTicketId === oldTicketId) return;

    if (oldTicketId) stopViewing(oldTicketId as string);
    startViewing(newTicketId as string);
  },
  { immediate: true }
);

type TicketUpdateData = {
  ticket_id: string;
  user: string;
  field: string;
  value: string;
};

onMounted(() => {
  fetchHandoff();
  socket.on("handoff_note", onHandoffNote);
  socket.on("ticket_reopened", onTicketReopened);

  ticketsToNavigate.update({
    params: {
      ticket: props.ticketId,
      current_view: route.query.view as string,
    },
  });
  ticketsToNavigate.reload();
  ticket.value.markSeen.reload();

  $socket.on("ticket_update", (data: TicketUpdateData) => {
    if (data.ticket_id === ticket.value?.name) {
      // Notify the user about the update
      toast.info(`User ${data.user} updated ${data.field} to ${data.value}`);
    }
  });

  $socket.on("helpdesk:ticket-comment", (data: { ticket_id: string }) => {
    if (data.ticket_id == props.ticketId) {
      ticketComposable.value.activities.reload();
    }
  });

  $socket.on("helpdesk:ticket-update", (data: { ticket_id: string }) => {
    if (data.ticket_id == props.ticketId) {
      reloadTicket(props.ticketId);
    }
  });
});

onBeforeUnmount(() => {
  stopViewing(props.ticketId);
  showEmailBox.value = false;
  showCommentBox.value = false;
  socket.off("handoff_note", onHandoffNote);
  socket.off("ticket_reopened", onTicketReopened);

  $socket.off("ticket_update");
  $socket.off("helpdesk:ticket-comment");
  $socket.off("helpdesk:ticket-update");
});

usePageMeta(() => {
  return {
    title: props.ticketId,
  };
});
</script>

<style>
.breadcrumbs button {
  background-color: inherit !important;
  &:hover,
  &:focus {
    background-color: inherit !important;
  }
}
</style>
