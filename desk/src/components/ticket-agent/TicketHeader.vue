<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex flex-col truncate">
        <Breadcrumbs :items="breadcrumbs" class="breadcrumbs">
          <template #prefix="{ item }">
            <Icon
              v-if="item.icon"
              :icon="item.icon"
              class="mr-1 h-4 flex items-center justify-center self-center"
            />
          </template>
        </Breadcrumbs>
        <TicketSLA />
      </div>
    </template>
    <template #right-header>
      <div class="flex gap-2 items-center">
        <MultipleAvatar
          :avatars="JSON.stringify(viewers)"
          size="md"
          :hide-name="true"
        />
        <!-- Navigation -->
        <TicketNavigation :key="ticket.name" />
        <!-- Custom Actions -->
        <div v-if="normalActions.length" class="flex gap-2">
          <Button v-for="action in normalActions" v-bind="action">
            <template v-if="action.icon" #prefix>
              <FeatherIcon :name="action.icon" class="h-4 w-4" />
            </template>
          </Button>
        </div>
        <div v-if="groupedWithLabelActions.length">
          <div v-for="g in groupedWithLabelActions" :key="g.label">
            <Dropdown v-slot="{ open }" :options="g.action">
              <Button :label="g.label">
                <template #suffix>
                  <FeatherIcon
                    :name="open ? 'chevron-up' : 'chevron-down'"
                    class="h-4"
                  />
                </template>
              </Button>
            </Dropdown>
          </div>
        </div>
        <!-- Open Chat -->
        <Button
          variant="subtle"
          :loading="chatLoading"
          @click="openChat"
          label="Open Chat"
        >
          <template #prefix>
            <FeatherIcon name="external-link" class="h-4 w-4" />
          </template>
        </Button>
        <!-- Snooze -->
        <SnoozeButton
          :ticket-name="ticket.doc.name"
          :is-snoozed="!!ticket.doc.is_snoozed"
          :snoozed-until="ticket.doc.snoozed_until"
          @change="ticket.reload()"
        />
        <!-- Status -->
        <Dropdown :options="statusDropdown" placement="right">
          <template #default="{ open }">
            <Button :label="ticket.doc.status" ref="statusRef">
              <template #prefix>
                <IndicatorIcon
                  :class="
                    ticketStatusStore.getStatus(ticket.doc.status)?.parsed_color
                  "
                />
              </template>
            </Button>
          </template>
        </Dropdown>
        <!-- Core Actions + Custom Actions -->
        <Dropdown
          v-if="groupedActions.length"
          :options="groupedActions"
          placement="right"
        >
          <Button icon="more-horizontal" />
        </Dropdown>
      </div>
    </template>
  </LayoutHeader>
  <TicketMergeModal
    :ticket="ticket.doc"
    v-if="showMergeModal"
    v-model="showMergeModal"
    @update="ticket.reload()"
  />
  <TicketSubjectModal v-if="showSubjectDialog" v-model="showSubjectDialog" />
  <HandoffModal
    v-if="showHandoffModal"
    v-model="showHandoffModal"
    :ticket-name="ticket.doc.name"
    @done="ticket.reload()"
  />
  <DispositionModal
    v-if="showDispositionModal"
    v-model="showDispositionModal"
    :target-status="pendingStatus"
    :ticket-type="ticket.doc?.ticket_type ?? null"
    @confirm="onDispositionConfirm"
    @cancel="pendingStatus = ''"
  />
  <QualityScoreModal
    v-if="showQualityModal"
    v-model="showQualityModal"
    :ticket-name="ticket.doc?.name"
  />
  <InitiateWhatsAppModal
    v-if="showInitiateWAModal"
    v-model="showInitiateWAModal"
    :ticket-name="ticket.doc?.name"
    :contact-phone="ticket.doc?.contact?.mobile_no"
    @sent="ticket.reload()"
  />
  <!-- CRM token renewal modal -->
  <CRMTokenModal v-if="showCRMTokenModal" v-model="showCRMTokenModal" />
  <!-- Open Chat: manual code entry -->
  <Dialog
    v-model="showChatModal"
    :options="{
      title: 'Open Customer Chat',
      actions: [
        {
          label: 'Open Chat',
          variant: 'solid',
          onClick: () => resolveAndOpenChat(manualCode),
        },
      ],
    }"
  >
    <template #body-content>
      <p class="mb-3 text-sm text-ink-gray-6">
        Customer code not found in subject. Enter it manually:
      </p>
      <TextInput
        v-model="manualCode"
        placeholder="e.g. 130666"
        autofocus
        @keydown.enter="resolveAndOpenChat(manualCode)"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { MultipleAvatar } from "@/components";
import LayoutHeader from "@/components/LayoutHeader.vue";
import TicketMergeModal from "@/components/ticket/TicketMergeModal.vue";
import { setupCustomizations } from "@/composables/formCustomisation";
import { useNotifyTicketUpdate } from "@/composables/realtime";
import { useShortcut } from "@/composables/shortcuts";
import { useView } from "@/composables/useView";
import { globalStore } from "@/stores/globalStore";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import {
  ActivitiesSymbol,
  CustomizationSymbol,
  TicketSymbol,
  View,
} from "@/types";
import { HDTicketStatus } from "@/types/doctypes";
import { getIcon } from "@/utils";
import { Breadcrumbs, call, Dropdown, toast } from "frappe-ui";
import { __ } from "@/translation";
import {
  computed,
  ComputedRef,
  h,
  inject,
  onMounted,
  PropType,
  ref,
  useTemplateRef,
  watchEffect,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import LucideMerge from "~icons/lucide/merge";
import { IndicatorIcon } from "../icons";
import DispositionModal from "@/components/ticket/DispositionModal.vue";
import TicketNavigation from "./TicketNavigation.vue";
import TicketSLA from "./TicketSLA.vue";
import TicketSubjectModal from "./TicketSubjectModal.vue";
import SnoozeButton from "./SnoozeButton.vue";
import HandoffModal from "./HandoffModal.vue";
import QualityScoreModal from "./QualityScoreModal.vue";
import InitiateWhatsAppModal from "@/components/ticket/InitiateWhatsAppModal.vue";
import CRMTokenModal from "@/components/ticket/CRMTokenModal.vue";
import { useAuthStore } from "@/stores/auth";

defineProps({
  viewers: {
    type: Array as PropType<string[]>,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();
const { findView } = useView("HD Ticket");
const ticketStatusStore = useTicketStatusStore();

const ticket = inject(TicketSymbol);
const customizations = inject(CustomizationSymbol);
const activities = inject(ActivitiesSymbol);

const showSubjectDialog = ref(false);

// Disposition gate: holds the target status while the modal is open
const showDispositionModal = ref(false);
const pendingStatus = ref("");

// Open Chat
const chatLoading = ref(false);
const showChatModal = ref(false);
const showCRMTokenModal = ref(false);
const manualCode = ref("");

function extractCustomerCode(subject: string): string | null {
  const match = subject?.match(/\(#(\d+)\)/);
  return match ? match[1] : null;
}

async function openChat() {
  const savedCode = ticket.value.doc?.fitelo_customer_code;
  const subjectCode = extractCustomerCode(ticket.value.doc?.subject);
  const code = savedCode || subjectCode;
  if (!code) {
    manualCode.value = "";
    showChatModal.value = true;
    return;
  }
  await resolveAndOpenChat(code);
}

async function resolveAndOpenChat(code: string) {
  const trimmed = code?.trim();
  if (!trimmed) return;
  showChatModal.value = false;
  chatLoading.value = true;
  try {
    const json = await call(
      "fitelo_helpdesk.api.permissions.lookup_fitelo_customer",
      { code: trimmed }
    );
    if (json?.error === "token_expired" || json?.error === "token_not_configured") {
      showCRMTokenModal.value = true;
      return;
    }
    if (!json?.data?.length) {
      toast.error("No customer found for that code");
      return;
    }
    const customerId = json.data[0].id;
    if (!ticket.value.doc?.fitelo_customer_code) {
      ticket.value.setValue.submit({ fitelo_customer_code: trimmed });
    }
    window.open(
      `https://admin-portal.fitelo.net/manage-users/manage-members/chats/${customerId}`,
      "_blank"
    );
  } catch {
    toast.error("Could not resolve customer, try manually");
    manualCode.value = trimmed;
    showChatModal.value = true;
  } finally {
    chatLoading.value = false;
  }
}

function submitStatus(status: string, extraFields: Record<string, string> = {}) {
  ticket.value.setValue.submit(
    { status, ...extraFields },
    {
      onSuccess() {
        activities.value.reload();
      },
    }
  );
}

function onDispositionConfirm(disposition: string) {
  showDispositionModal.value = false;
  const status = pendingStatus.value;
  pendingStatus.value = "";
  ticket.value.setValue.submit(
    { status, disposition },
    {
      onSuccess() {
        activities.value.reload();
        router.push({ name: "TicketsAgent", query: { view: "hd-view-cs-pending" } });
      },
    }
  );
}

const { notifyTicketUpdate } = useNotifyTicketUpdate(ticket.value?.name);
const statusDropdown = computed(() => {
  const statuses =
    ticketStatusStore.statuses.data?.filter((s) => s.enabled) || [];
  return statuses.map((o: HDTicketStatus) => ({
    label: o.label_agent,
    value: o.label_agent,
    onClick: () => {
      notifyTicketUpdate("Status", o.label_agent);
      if (ticket.value.doc.status === o.label_agent) return;
      if (o.category === "Resolved") {
        pendingStatus.value = o.label_agent;
        showDispositionModal.value = true;
      } else {
        submitStatus(o.label_agent);
      }
    },
    icon: () =>
      h(IndicatorIcon, {
        class: o.parsed_color,
      }),
  }));
});
const breadcrumbs = computed(() => {
  let items = [{ label: __("Tickets"), route: { name: "TicketsAgent" } }];
  if (route.query.view) {
    const currView: ComputedRef<View> = findView(route.query.view as string);
    if (currView) {
      items.push({
        label: currView.value?.label,
        icon: getIcon(currView.value?.icon),
        route: { name: "TicketsAgent", query: { view: currView.value?.name } },
      });
    }
  }
  items.push({
    label: ticket.value.doc?.subject,
    onClick: () => {
      showSubjectDialog.value = true;
    },
  });
  return items;
});

function updateField(fieldname: string, value: string, callback = () => {}) {
  const doc = ticket.value;
  doc.setValue.submit({
    [fieldname]: value,
  });
  callback();
}

const authStore = useAuthStore();
const showHandoffModal = ref(false);
const showMergeModal = ref(false);
const showQualityModal = ref(false);
const showInitiateWAModal = ref(false);
const showMergeOption = computed(() => {
  return (
    !ticket.value.doc.is_merged &&
    ["Open", "Paused"].includes(ticket.value.doc.status_category)
  );
});
const defaultActions = computed(() => {
  let items = [];

  if (showMergeOption.value) {
    items.push({
      label: __("Merge Ticket"),
      icon: LucideMerge,
      condition: () => !ticket.value.doc.is_merged,
      onClick: () => (showMergeModal.value = true),
    });
  }
  items.push({
    label: __("Handoff Ticket"),
    onClick: () => (showHandoffModal.value = true),
  });
  items.push({
    label: __("Mark as Waiting"),
    onClick: () => submitStatus("Waiting for Customer"),
  });
  items.push({
    label: __("Send via WhatsApp"),
    onClick: () => (showInitiateWAModal.value = true),
  });
  if (authStore.isManager) {
    items.push({
      label: __("Rate Quality"),
      onClick: () => (showQualityModal.value = true),
    });
  }
  return [
    {
      group: __("Default actions"),
      hideLabel: true,
      items,
    },
  ];
});
const actions = ref([]);
const normalActions = computed(() => {
  return actions.value.filter((action) => !action.group);
});

const groupedWithLabelActions = computed(() => {
  let _actions = [];

  actions.value
    .filter((action) => action.buttonLabel && action.group)
    .forEach((action) => {
      let groupIndex = _actions.findIndex(
        (a) => a.label === action.buttonLabel
      );
      if (groupIndex > -1) {
        _actions[groupIndex].action.push(action);
      } else {
        _actions.push({
          label: action.buttonLabel,
          action: [action],
        });
      }
    });
  return _actions;
});

const groupedActions = computed(() => {
  let _actions = [];
  _actions = _actions.concat(
    actions.value.filter((action) => action.group && !action.buttonLabel)
  );
  return _actions;
});

const customizationCtx = computed(() => ({
  doc: ticket?.value?.doc,
  call,
  router,
  toast,
  $dialog: globalStore().$dialog,
  updateField,
  createToast: toast.create,
}));

// to manage the correct  customization context for actions, happens because of navigation between tickets using buttons
watchEffect(async () => {
  if (customizations.value?.data) {
    await setupCustomizations(
      customizations.value.data,
      customizationCtx.value
    );

    actions.value = [
      ...defaultActions.value,
      ...(customizations.value?.data?._customActions || []),
    ];
  }
});

const statusRef = useTemplateRef("statusRef");

onMounted(() => {
  useShortcut("s", () => {
    statusRef.value?.$el?.nextElementSibling?.click();
  });
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
