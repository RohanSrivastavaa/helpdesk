<template>
  <!-- AI Triage suggestion banner -->
  <TicketAISuggestion />

  <Tabs
    :modelValue="tabIndex"
    :tabs="tabs"
    @update:modelValue="changeTabTo"
    class="[&_[role='tab']]:px-0 [&_[role='tablist']]:px-5 [&_[role='tablist']]:gap-7.5 [&_[role='tablist']]:flex-shrink-0"
  >
    <template #tab-panel="{ tab }">
      <!-- WhatsApp tab renders its own component -->
      <WhatsAppArea v-if="tab.name === 'whatsapp'" />

      <!-- Internal notes tab -->
      <InternalNoteArea v-else-if="tab.name === 'notes'" class="h-full" />

      <!-- All other tabs -->
      <template v-else>
        <TicketAgentActivities
          v-if="Boolean(activities.data)"
          ref="ticketAgentActivitiesRef"
          :activities="filterActivities(tab.name as TicketTab)"
          :title="tab.label"
          :ticket-status="ticket.doc.status"
          @email:reply="
            (e) => {
              communicationAreaRef.replyToEmail(e);
            }
          "
          @update="
            () => {
              activities.reload();
              ticketAgentActivitiesRef.scrollToLatestActivity();
            }
          "
        />
        <div v-else class="flex items-center justify-center flex-col mt-20">
          <LoadingIndicator :scale="8" class="text-ink-gray-5" />
          <p class="text-xl font-medium text-ink-gray-5 absolute top-[50%]">
            Loading...
          </p>
        </div>
      </template>
    </template>
  </Tabs>
  <!-- Comm Area (hidden when on WhatsApp or Notes tab) -->
  <CommunicationArea
    v-if="tabs[tabIndex]?.name !== 'whatsapp' && tabs[tabIndex]?.name !== 'notes'"
    ref="communicationAreaRef"
    :ticketId="String(ticket.doc?.name)"
    :to-emails="[ticket.doc?.raised_by]"
    :cc-emails="[]"
    :bcc-emails="[]"
    :key="ticket.doc?.name"
    @update="
      () => {
        activities.reload();
        ticketAgentActivitiesRef.scrollToLatestActivity();
      }
    "
  />
</template>

<script setup lang="ts">
import {
  ActivityIcon,
  EmailIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/icons";
import LucideLock from "~icons/lucide/lock";
import { useActiveTabManager } from "@/composables/useActiveTabManager";
import { useTelephonyStore } from "@/stores/telephony";
import {
  ActivitiesSymbol,
  FeedbackActivity,
  TabObject,
  TicketSymbol,
  TicketTab,
} from "@/types";
import { call, LoadingIndicator, Tabs } from "frappe-ui";
import { storeToRefs } from "pinia";
import {
  computed,
  ComputedRef,
  defineAsyncComponent,
  inject,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import TicketAgentActivities from "../ticket/TicketAgentActivities.vue";
import WhatsAppArea from "../ticket/WhatsAppArea.vue";
import InternalNoteArea from "../ticket/InternalNoteArea.vue";
import TicketAISuggestion from "./TicketAISuggestion.vue";
import { socket } from "@/socket";

const CommunicationArea = defineAsyncComponent(
  () => import("@/components/CommunicationArea.vue")
);

const ticket = inject(TicketSymbol);
const activities = inject(ActivitiesSymbol);

const ticketAgentActivitiesRef = ref(null);
const communicationAreaRef = ref(null);
const telephonyStore = useTelephonyStore();
const { isCallingEnabled } = storeToRefs(telephonyStore);

// WhatsApp messages for the omnichannel timeline
const waMessages = ref<any[]>([]);

async function fetchWaMessages() {
  const name = ticket.value?.doc?.name;
  if (!name || !ticket.value?.doc?.whatsapp_number) return;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.get_whatsapp_messages",
      { ticket_name: name }
    );
    waMessages.value = result ?? [];
  } catch {
    waMessages.value = [];
  }
}

watch(
  () => ticket.value?.doc?.name,
  (name) => { if (name) fetchWaMessages(); },
  { immediate: true }
);

function onWaMessage(data: { ticket: string }) {
  if (data.ticket === ticket.value?.doc?.name) fetchWaMessages();
}

onMounted(() => socket.on("whatsapp_message", onWaMessage));
onUnmounted(() => socket.off("whatsapp_message", onWaMessage));

const tabs: ComputedRef<TabObject[]> = computed(() => {
  const _tabs: TabObject[] = [
    {
      name: "activity",
      label: "Activity",
      icon: ActivityIcon,
    },
    {
      name: "email",
      label: "Emails",
      icon: EmailIcon,
    },
  ];

  const hasCalls = (activities.value?.data?.calls?.length ?? 0) > 0;
  if (isCallingEnabled.value && hasCalls) {
    _tabs.push({
      name: "call",
      label: "Calls",
      icon: PhoneIcon,
    });
  }

  const isWaTicket = ["WhatsApp", "Waaku WhatsApp"].includes(
    ticket.value.doc?.ticket_source
  );
  if (isWaTicket || ticket.value.doc?.whatsapp_number || waMessages.value.length > 0) {
    _tabs.push({
      name: "whatsapp",
      label: "WhatsApp",
      icon: WhatsAppIcon,
    });
  }

  _tabs.push({
    name: "notes",
    label: "Notes",
    icon: LucideLock,
  });

  return _tabs;
});

const { tabIndex, changeTabTo } = useActiveTabManager(tabs);

// TODO: refactor for pagination
// can be done once we sort out the backend
const _activities = computed(() => {
  if (!activities.value?.data) {
    return [];
  }

  const emailProps = activities.value?.data?.communications.map(
    (email, idx: number) => {
      return {
        subject: email.subject,
        content: email.content,
        sender: { name: email.user.email, full_name: email.user.name },
        to: email.recipients,
        type: "email",
        key: email.creation,
        cc: email.cc,
        bcc: email.bcc,
        creation: email.creation,
        attachments: email.attachments,
        name: email.name,
        deliveryStatus: email.delivery_status,
        isFirstEmail: idx === 0,
      };
    }
  );

  const commentProps = activities.value.data.comments.map((comment) => {
    return {
      name: comment.name,
      type: "comment",
      key: comment.creation,
      commentedBy: comment.commented_by,
      commenter: comment.user.name,
      creation: comment.creation,
      content: comment.content,
      attachments: comment.attachments,
    };
  });

  const historyProps = [
    ...activities.value.data.history,
    ...activities.value.data.views,
  ].map((h) => {
    return {
      type: "history",
      key: h.creation,
      content: h.action ? h.action : "viewed this",
      creation: h.creation,
      user: h.user.name + " ",
    };
  });

  const callProps = activities.value.data.calls.map((call) => {
    return {
      ...call,
      type: "call",
      name: call.name,
      key: call.creation,
      call_type: call.type,
      content: `${call.caller || "Unknown"} made a call to ${
        call.receiver || "Unknown"
      }`,
      duration: call.duration ? call.duration + "s" : "0s",
    };
  });

  const waProps = waMessages.value.map((msg) => ({
    type: "whatsapp",
    key: `wa-${msg.name}`,
    name: msg.name,
    creation: msg.creation,
    direction: msg.type, // "Incoming" or "Outgoing"
    message: msg.message,
    from: msg.from,
    to: msg.to,
    profile_name: msg.profile_name,
    content_type: msg.content_type,
    attach: msg.attach,
  }));

  const sorted = [
    ...emailProps,
    ...commentProps,
    ...historyProps,
    ...callProps,
    ...waProps,
  ].sort((a, b) => new Date(a.creation).getTime() - new Date(b.creation).getTime());
  const data = [];
  let i = 0;

  while (i < sorted.length) {
    const currentActivity = sorted[i];

    if (currentActivity.type === "history") {
      currentActivity.relatedActivities = [currentActivity];
      for (let j = i + 1; j < sorted.length + 1; j++) {
        const nextActivity = sorted[j];

        if (
          nextActivity &&
          nextActivity.user === currentActivity.user &&
          nextActivity.content !== "viewed this" &&
          !nextActivity.content.includes("assigned") &&
          !nextActivity.content.includes("unassigned")
        ) {
          currentActivity.relatedActivities.push(nextActivity);
        } else {
          data.push(currentActivity);
          i = j - 1;
          break;
        }
      }
    } else {
      data.push(currentActivity);
    }
    i++;
  }
  // add feedback data at the last always
  // name is email
  // full_name is name

  if (ticket.value.doc.feedback_rating === 0) {
    return data;
  }
  let feedbackActivity: FeedbackActivity[] = [
    {
      type: "feedback",
      key: "feedback-activity",
      feedback_rating: ticket.value?.doc.feedback_rating,
      feedback_extra: ticket.value?.doc.feedback_extra,
      feedback: ticket.value?.doc.feedback,
      sender: {
        name: ticket.value?.doc.raised_by,
        full_name: ticket.value?.doc.contact,
      },
    },
  ];
  data.push(...feedbackActivity);

  return data;
});

function filterActivities(eventType: TicketTab) {
  if (eventType === "activity") {
    return _activities.value;
  }
  // "whatsapp" tab renders WhatsAppArea separately, but keep filter for completeness
  return _activities.value.filter((activity) => activity.type === eventType);
}
</script>

<style scoped></style>
