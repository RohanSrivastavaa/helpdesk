<template>
  <div>
    <!-- Feature 5: Summary bar for chat support manager views -->
    <div v-if="showSummaryBar" class="flex items-center gap-5 px-6 py-2.5 bg-white border-b border-outline-gray-2 text-sm">
      <span class="text-xs font-semibold text-ink-gray-4 uppercase tracking-wide">Summary</span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full" style="background:#FF4444" />
        <span class="text-ink-gray-7"><strong class="text-ink-gray-9">{{ summaryData.open_count ?? '—' }}</strong> open</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full" style="background:#22c55e" />
        <span class="text-ink-gray-7"><strong class="text-ink-gray-9">{{ summaryData.resolved_today ?? '—' }}</strong> resolved today</span>
      </span>
      <span v-if="summaryData.avg_resolution_mins != null" class="text-ink-gray-5 text-xs">
        Avg resolve: <strong class="text-ink-gray-7">{{ summaryData.avg_resolution_mins }}m</strong>
      </span>
    </div>
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs
          :label="__('Tickets')"
          :route-name="isCustomerPortal ? 'TicketsCustomer' : 'TicketsAgent'"
          :options="dropdownOptions"
          :dropdown-actions="viewActions"
          :current-view="currentView"
        />
      </template>
      <template #right-header>
        <RouterLink
          :to="{ name: isCustomerPortal ? 'TicketNew' : 'TicketAgentNew' }"
        >
          <Button label="Create" theme="gray" variant="solid">
            <template #prefix>
              <LucidePlus class="h-4 w-4" />
            </template>
          </Button>
        </RouterLink>
      </template>
    </LayoutHeader>
    <ListViewBuilder
      ref="listViewRef"
      :options="options"
      @empty-state-action="
        () =>
          $router.push({
            name: isCustomerPortal ? 'TicketNew' : 'TicketAgentNew',
          })
      "
      @row-click="
        (row) =>
          $router.push({
            name: isCustomerPortal ? 'TicketCustomer' : 'TicketAgent',
            params: { ticketId: row },
          })
      "
    />
    <ExportModal
      v-model="showExportModal"
      :rowCount="$refs.listViewRef?.list?.data?.total_count ?? 0"
      @update="
        ({ export_type, export_all }) => exportRows(export_type, export_all)
      "
    />
    <ViewModal
      v-if="viewDialog.show"
      v-model="viewDialog"
      @update="(view, action) => handleView(view, action)"
    />

    <!-- Bulk Action Dialog -->
    <Dialog
      v-model="showBulkDialog"
      :options="{
        title: bulkDialogTitles[bulkDialogType] || 'Bulk Action',
        size: 'sm',
        actions: [
          {
            label: 'Apply',
            variant: 'solid',
            loading: bulkLoading,
            onClick: applyBulkAction,
          },
        ],
      }"
    >
      <template #body-content>
        <div class="py-2">
          <select
            v-model="bulkDialogValue"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="" disabled>Select…</option>
            <option
              v-for="opt in bulkDialogOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader, ListViewBuilder } from "@/components";
import {
  EditIcon,
  PinIcon,
  TicketIcon,
  UnpinIcon,
  WhatsAppIcon,
} from "@/components/icons";
import ExportModal from "@/components/ticket/ExportModal.vue";
import ViewBreadcrumbs from "@/components/ViewBreadcrumbs.vue";
import ViewModal from "@/components/ViewModal.vue";
import { currentView, useView } from "@/composables/useView";
import { dayjs } from "@/dayjs";
import { useAuthStore } from "@/stores/auth";
import { globalStore } from "@/stores/globalStore";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { __ } from "@/translation";
import { View } from "@/types";
import { getIcon, isCustomerPortal } from "@/utils";
import { Badge, call, Dialog, FeatherIcon, toast, Tooltip, usePageMeta } from "frappe-ui";
import { computed, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { socket } from "@/socket";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();

const {
  getCurrentUserViews,
  createView,
  publicViews,
  pinnedViews,
  findView,
  updateView,
  deleteView,
} = useView("HD Ticket");

const { $dialog, $socket } = globalStore();
const authStore = useAuthStore();
const { isManager, userId } = authStore;

const listViewRef = ref(null);
const showExportModal = ref(false);

// ── Feature 4: Agent status dots ─────────────────────────────────────────────
const agentStatusMap = ref<Record<string, string>>({});

async function fetchAgentStatuses() {
  try {
    const statuses: any[] = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_all_agent_statuses"
    );
    const map: Record<string, string> = {};
    for (const s of statuses ?? []) {
      if (s.user) map[s.user] = s.status;
    }
    agentStatusMap.value = map;
  } catch {}
}

// ── Feature 5: Chat Support summary bar ──────────────────────────────────────
const CS_VIEWS = ["hd-view-cs-pending", "hd-view-cs-unassigned", "hd-view-cs-completed"];
const showSummaryBar = computed(
  () =>
    !isCustomerPortal.value &&
    authStore.isManager &&
    CS_VIEWS.includes(route.query.view as string)
);
const summaryData = ref<{ open_count: number | null; resolved_today: number | null; avg_resolution_mins: number | null }>({
  open_count: null,
  resolved_today: null,
  avg_resolution_mins: null,
});

async function fetchSummary() {
  try {
    const data: any = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.dashboards.get_chat_support_summary"
    );
    summaryData.value = data;
  } catch {}
}

const { getStatus, colorMap: statusColorMap } = useTicketStatusStore();

const listSelections = ref(new Set());

// Bulk action state
const showBulkDialog = ref(false);
const bulkDialogType = ref<"assign" | "status" | "priority" | null>(null);
const bulkDialogValue = ref("");
const bulkDialogOptions = ref<{ label: string; value: string }[]>([]);
const bulkLoading = ref(false);
const bulkSelections = ref<string[]>([]);
const bulkDialogTitles: Record<string, string> = {
  assign: __("Assign to Agent"),
  status: __("Change Status"),
  priority: __("Change Priority"),
};

async function openBulkDialog(
  type: "assign" | "status" | "priority",
  selections: Set<string>
) {
  bulkSelections.value = Array.from(selections);
  bulkDialogType.value = type;
  bulkDialogValue.value = "";
  bulkDialogOptions.value = [];
  showBulkDialog.value = true;

  if (type === "assign") {
    const agents = await call("frappe.client.get_list", {
      doctype: "HD Agent",
      fields: ["name", "agent_name"],
      limit: 100,
    });
    bulkDialogOptions.value = (agents ?? []).map((a: any) => ({
      label: a.agent_name || a.name,
      value: a.name,
    }));
  } else if (type === "status") {
    const statuses = await call("frappe.client.get_list", {
      doctype: "HD Ticket Status",
      fields: ["name"],
      limit: 50,
    });
    bulkDialogOptions.value = (statuses ?? []).map((s: any) => ({
      label: s.name,
      value: s.name,
    }));
  } else if (type === "priority") {
    const priorities = await call("frappe.client.get_list", {
      doctype: "HD Ticket Priority",
      fields: ["name"],
      limit: 20,
    });
    bulkDialogOptions.value = (priorities ?? []).map((p: any) => ({
      label: p.name,
      value: p.name,
    }));
  }
}

async function applyBulkAction() {
  if (!bulkDialogValue.value) {
    toast.error("Please select a value");
    return;
  }
  bulkLoading.value = true;
  try {
    const methodMap: Record<string, string> = {
      assign: "fitelo_helpdesk.fitelo_helpdesk.api.bulk_actions.bulk_assign",
      status:
        "fitelo_helpdesk.fitelo_helpdesk.api.bulk_actions.bulk_update_status",
      priority:
        "fitelo_helpdesk.fitelo_helpdesk.api.bulk_actions.bulk_update_priority",
    };
    const paramMap: Record<string, Record<string, any>> = {
      assign: {
        ticket_names: bulkSelections.value,
        assignee: bulkDialogValue.value,
      },
      status: {
        ticket_names: bulkSelections.value,
        status: bulkDialogValue.value,
      },
      priority: {
        ticket_names: bulkSelections.value,
        priority: bulkDialogValue.value,
      },
    };
    const result: any = await call(
      methodMap[bulkDialogType.value!],
      paramMap[bulkDialogType.value!]
    );
    toast.success(__("{0} ticket(s) updated", [result.count]));
    showBulkDialog.value = false;
    reset(true);
  } catch {
    toast.error("Failed to apply bulk action");
  } finally {
    bulkLoading.value = false;
  }
}

async function confirmBulkDelete(selections: Set<string>) {
  const names = Array.from(selections);
  $dialog({
    title: __("Delete {0} ticket(s)?", [names.length]),
    message: __("This action is permanent and cannot be undone."),
    actions: [
      {
        label: __("Delete"),
        variant: "solid",
        theme: "red",
        async onClick({ close }) {
          close();
          try {
            const result: any = await call(
              "fitelo_helpdesk.fitelo_helpdesk.api.bulk_actions.bulk_delete",
              { ticket_names: names }
            );
            toast.success(__("{0} ticket(s) deleted", [result.count]));
            reset(true);
          } catch {
            toast.error("Failed to delete tickets");
          }
        },
      },
    ],
  });
}

const selectBannerActions = [
  {
    label: __("Export"),
    icon: "download",
    onClick: (selections: Set<string>) => {
      listSelections.value = new Set(selections);
      showExportModal.value = true;
    },
  },
  ...(isManager
    ? [
        {
          label: __("Assign"),
          icon: "user",
          onClick: (selections: Set<string>) =>
            openBulkDialog("assign", selections),
        },
        {
          label: __("Set Status"),
          icon: "tag",
          onClick: (selections: Set<string>) =>
            openBulkDialog("status", selections),
        },
        {
          label: __("Set Priority"),
          icon: "alert-circle",
          onClick: (selections: Set<string>) =>
            openBulkDialog("priority", selections),
        },
        {
          label: __("Delete"),
          icon: "trash-2",
          onClick: (selections: Set<string>) => confirmBulkDelete(selections),
        },
      ]
    : []),
];

const options = {
  doctype: "HD Ticket",
  columnConfig: {
    subject: {
      custom: ({ row, item }) => {
        const seenBy = row._seen ? JSON.parse(row._seen) : [];
        const isSeen = seenBy.includes(userId || "");
        return h(
          "span",
          {
            class: ["truncate flex-1", !isSeen && "font-semibold"],
          },
          item
        );
      },
    },
    status: {
      custom: ({ item }) => {
        const status = getStatus(item);
        const label = isCustomerPortal.value
          ? status?.["label_customer"]
          : status?.["label_agent"];
        const color = (status?.["color"] ?? "Default") as keyof typeof statusColorMap;
        const [textClass, bgClass] = statusColorMap[color] ?? statusColorMap["Default"];
        return h(
          "span",
          {
            class: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-full ${textClass} ${bgClass}`,
          },
          label ?? item
        );
      },
    },
    agreement_status: {
      custom: ({ item }) => {
        return h(Badge, {
          label: item,
          theme: slaStatusColorMap[item],
          variant: "outline",
        });
      },
    },
    response_by: {
      custom: ({ row, item }) => handle_response_by_field(row, item),
    },
    resolution_by: {
      custom: ({ row, item }) => handle_resolution_by_field(row, item),
    },
    priority: {
      custom: ({ item }) => {
        if (!item) return h("span", { class: "text-ink-gray-3 text-xs" }, "—");
        const colorMap: Record<string, string> = {
          Urgent: "text-red-600 bg-red-50 border-red-200",
          High:   "text-orange-600 bg-orange-50 border-orange-200",
          Medium: "text-amber-600 bg-amber-50 border-amber-200",
          Low:    "text-green-600 bg-green-50 border-green-200",
        };
        return h("span", {
          class: `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${colorMap[item] || "text-ink-gray-6 border-outline-gray-2"}`,
        }, item);
      },
    },
    ticket_source: {
      custom: ({ item }) => {
        const sourceMap: Record<string, { icon: any; color: string; pill: string; label: string }> = {
          WhatsApp:         { icon: WhatsAppIcon, color: "text-green-600",  pill: "bg-green-50 border border-green-200",  label: "WhatsApp" },
          "Waaku WhatsApp": { icon: WhatsAppIcon, color: "text-purple-600", pill: "bg-purple-50 border border-purple-200", label: "Waaku WA" },
          Email:            { icon: "mail",       color: "text-blue-600",   pill: "bg-blue-50 border border-blue-200",    label: "Email" },
          Phone:            { icon: "phone",      color: "text-purple-500", pill: "bg-purple-50 border border-purple-200", label: "Phone" },
          Portal:           { icon: "globe",      color: "text-gray-500",   pill: "bg-gray-100 border border-gray-200",   label: "Portal" },
        };
        const src = sourceMap[item];
        if (!src) return h("span", { class: "text-ink-gray-4 text-xs" }, item || "—");
        const iconEl =
          item === "WhatsApp" || item === "Waaku WhatsApp"
            ? h(WhatsAppIcon, { class: `h-3 w-3 ${src.color}` })
            : h(FeatherIcon, { name: src.icon, class: `h-3 w-3 ${src.color}` });
        return h(
          "span",
          { class: `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${src.color} ${src.pill}` },
          [iconEl, src.label]
        );
      },
    },
    _assign: {
      custom: ({ item }) => {
        if (!item) return h("span", { class: "text-ink-gray-4 text-xs italic" }, "Unassigned");
        let emails: string[] = [];
        try { emails = JSON.parse(item); } catch { emails = []; }
        if (!emails.length) return h("span", { class: "text-ink-gray-4 text-xs italic" }, "Unassigned");
        const parts = emails.map((e) => {
          const local = (e.split("@")[0] ?? "").replace(/[._-]/g, " ");
          const first = local.split(" ")[0] ?? local;
          const name = first.charAt(0).toUpperCase() + first.slice(1);
          const status = agentStatusMap.value[e];
          const dotColor =
            status === "Online" ? "#22c55e"
            : !status || status === "Offline" ? "#9ca3af"
            : "#f59e0b";
          return h("span", { class: "inline-flex items-center gap-1" }, [
            h("span", {
              class: "inline-block w-2 h-2 rounded-full flex-shrink-0",
              style: `background:${dotColor}; margin-top:1px`,
              title: status ?? "Offline",
            }),
            h("span", {}, name),
          ]);
        });
        return h("span", { class: "text-sm text-ink-gray-8 inline-flex items-center gap-2 truncate" }, parts);
      },
    },
    creation: {
      custom: ({ row, item }) => {
        if (!item) return h("span", { class: "text-ink-gray-4 text-xs" }, "—");
        const resolvedStatuses = ["Resolved", "Closed"];
        const isResolved = resolvedStatuses.includes(row.status);
        const ageHours = dayjs().diff(dayjs(item), "hour");
        const isOverdue = !isResolved && ageHours >= 24;
        return h("div", { class: "flex flex-col gap-0.5" }, [
          h(Tooltip,
            { text: dayjs(item).format("DD MMM YYYY, h:mm A") },
            () => h("span", { class: "text-xs text-ink-gray-6" }, dayjs(item).fromNow())
          ),
          isOverdue
            ? h("span", {
                class: "text-[10px] font-semibold px-1 py-0.5 rounded w-fit",
                style: "background:#FEE2E2; color:#DC2626",
              }, `${ageHours}h overdue`)
            : null,
        ].filter(Boolean));
      },
    },
  },
  isCustomerPortal: isCustomerPortal.value,
  selectable: true,
  showSelectBanner: true,
  selectBannerActions,
  emptyState: {
    title: __("No Tickets Found"),
    icon: h(TicketIcon, {
      class: "h-10 w-10",
    }),
  },
  rowRoute: {
    name: isCustomerPortal.value ? "TicketCustomer" : "TicketAgent",
    prop: "ticketId",
  },
  hideColumnSetting: false,
};

function handle_response_by_field(row: any, item: string) {
  if (!row.first_responded_on && dayjs(item).isBefore(new Date())) {
    return h(Badge, {
      label: __("Failed"),
      theme: "red",
      variant: "outline",
    });
  }
  if (row.first_responded_on && dayjs(row.first_responded_on).isBefore(item)) {
    return h(Badge, {
      label: __("Fulfilled"),
      theme: "green",
      variant: "outline",
    });
  } else if (dayjs(row.first_responded_on).isAfter(item)) {
    return h(Badge, {
      label: __("Failed"),
      theme: "red",
      variant: "outline",
    });
  } else {
    return h(
      Tooltip,
      {
        text: dayjs(item).long(),
      },
      () => dayjs.tz(item).fromNow()
    );
  }
}

function handle_resolution_by_field(row: any, item: string) {
  const status = getStatus(row.status) || {};
  if (status.category === "Paused") {
    return h(Badge, {
      label: __("Paused"),
      theme: "blue",
      variant: "outline",
    });
  } else if (row.resolution_date && dayjs(row.resolution_date).isBefore(item)) {
    return h(Badge, {
      label: __("Fulfilled"),
      theme: "green",
      variant: "outline",
    });
  } else if (dayjs(row.resolution_date).isAfter(item)) {
    return h(Badge, {
      label: __("Failed"),
      theme: "red",
      variant: "outline",
    });
  } else {
    return h(
      Tooltip,
      {
        text: dayjs(item).long(),
      },
      () => dayjs.tz(item).fromNow()
    );
  }
}

async function exportRows(
  export_type: "CSV" | "Excel" = "Excel",
  export_all: boolean = false
) {
  const list = listViewRef.value?.list;
  if (!list) return;

  const fields = JSON.stringify(list.data.columns.map((f) => f.key));
  const order_by = list.params.order_by;

  let filters = { ...list.params.filters };
  let pageLength: number;

  if (export_all) {
    filters = JSON.stringify(filters);
    pageLength = list.data.total_count;
  } else {
    pageLength = listSelections.value.size;
    filters["name"] = ["in", Array.from(listSelections.value)];
    filters = JSON.stringify(filters);
  }

  window.location.href = `/api/method/frappe.desk.reportview.export_query?file_format_type=${export_type}&title=HD Ticket&doctype=HD Ticket&fields=${fields}&filters=${filters}&order_by=${order_by}&page_length=${pageLength}&start=0&view=Report&with_comment_count=1`;
  reset();
  showExportModal.value = false;
}

function reset(reload = false) {
  listViewRef.value?.unselectAll();
  listSelections.value?.clear();
  if (reload) listViewRef.value.reload();
}

const slaStatusColorMap = {
  Fulfilled: "green",
  Failed: "red",
  "Resolution Due": "orange",
  "First Response Due": "orange",
  Paused: "blue",
};

let viewDialog = reactive({
  show: false,
  view: {
    label: "",
    icon: "",
    name: "",
  },
  mode: "create",
});

const dropdownOptions = computed(() => {
  const items = [
    {
      group: __("Default Views"),
      items: [
        {
          label: __("List View"),
          icon: "align-justify",
          onClick: () =>
            router.push({
              name: isCustomerPortal.value ? "TicketsCustomer" : "TicketsAgent",
            }),
        },
      ],
    },
  ];

  // Saved Views
  if (getCurrentUserViews.value?.length !== 0) {
    items.push({
      group: __("Saved Views"),
      items: parseViews(getCurrentUserViews.value),
    });
  }
  if (pinnedViews.value?.length !== 0) {
    items.push({
      group: __("Private Views"),
      items: parseViews(pinnedViews.value),
    });
  }
  if (publicViews.value?.length !== 0) {
    items.push({
      group: __("Public Views"),
      items: parseViews(publicViews.value),
    });
  }

  items.push({
    group: __("Create View"),
    hideLabel: true,
    items: [
      {
        label: __("Create View"),
        icon: "plus",
        onClick: () => {
          resetState();
          viewDialog.show = true;
        },
      },
    ],
  });

  return items;
});

let selectedView: View | null = null;

const viewActions = (view) => {
  const _view = findView(view.name).value;

  let actions = [
    {
      group: __("Default Views"),
      hideLabel: true,
      items: [
        {
          label: __("Duplicate"),
          icon: h(FeatherIcon, { name: "copy" }),
          onClick: () => {
            viewDialog.view.label = _view.label + " (New)";
            viewDialog.view.icon = _view.icon;
            viewDialog.view.name = _view.name;
            viewDialog.mode = "duplicate";
            selectedView = _view;
            viewDialog.show = true;
          },
        },
      ],
    },
  ];
  if (!_view.public || isManager) {
    actions[0].items.push({
      label: __("Edit"),
      icon: h(EditIcon, { class: "h-4 w-4" }),
      onClick: () => {
        viewDialog.view.label = _view.label;
        viewDialog.view.icon = _view.icon;
        viewDialog.view.name = _view.name;
        viewDialog.mode = "edit";
        viewDialog.show = true;
      },
    });
    if (!_view.public) {
      actions[0].items.push({
        label: _view?.pinned ? __("Unpin View") : __("Pin View"),
        icon: h(_view?.pinned ? UnpinIcon : PinIcon, { class: "h-4 w-4" }),
        onClick: () => {
          const newView = {
            name: _view.name,
          };
          newView["pinned"] = !_view.pinned;
          updateView(newView);
        },
      });
    }
    if (isManager && !isCustomerPortal.value) {
      actions[0].items.push({
        label: _view?.public ? __("Make Private") : __("Make Public"),
        icon: h(FeatherIcon, {
          name: _view?.public ? "lock" : "unlock",
          class: "h-4 w-4",
        }),
        onClick: () => {
          const newView = {
            name: _view.name,
            public: !_view.public,
          };

          if (_view.public) {
            $dialog({
              title: __("Make {0} private?", [_view.label]),
              message: __(
                "This view is currently public. Changing it to private will hide it for all the users."
              ),
              actions: [
                {
                  label: __("Confirm"),
                  variant: "solid",
                  onClick({ close }) {
                    close();
                    updateView(newView);
                  },
                },
              ],
            });
          } else {
            updateView(newView);
          }
        },
      });
    }
    actions.push({
      group: __("Delete View"),
      hideLabel: true,
      items: [
        {
          label: __("Delete"),
          icon: "trash-2",
          onClick: () => {
            $dialog({
              title: __("Delete {0}?", [_view.label]),
              message:
                __("Are you sure you want to delete this view?") +
                (_view.public
                  ? " " +
                    __(
                      "This view is public, and will be removed for all users."
                    )
                  : ""),
              actions: [
                {
                  label: __("Confirm"),
                  variant: "solid",
                  onClick({ close }) {
                    if (route.query.view === _view.name) {
                      router.push({
                        name: isCustomerPortal.value
                          ? "TicketsCustomer"
                          : "TicketsAgent",
                      });
                    }
                    deleteView(_view.name);
                    handleSuccess(__("deleted"));
                    close();
                  },
                },
              ],
            });
          },
        },
      ],
    });
  }

  return actions;
};

function parseViews(views: View[]) {
  return views?.map((view) => {
    return {
      ...view,
      onClick: () => {
        currentView.value = {
          label: view.label,
          icon: view.icon,
        };
        router.push({
          name: view.route_name,
          query: {
            view: view.name,
          },
        });
      },
    };
  });
}

function handleView(viewInfo, action) {
  let view: View;
  if (action === "update") {
    updateView(viewInfo);
    handleSuccess("updated");
    currentView.value = {
      label: viewInfo.label,
      icon: getIcon(viewInfo.icon),
    };
    return;
  } else if (action === "duplicate") {
    view = {
      ...selectedView,
      filters: JSON.stringify(selectedView.filters),
      columns: JSON.stringify(selectedView.columns),
      rows: JSON.stringify(selectedView.rows),
      label: viewInfo.label,
      icon: viewInfo.icon,
      public: false,
      pinned: false,
    };
  } else {
    view = {
      dt: "HD Ticket",
      type: "list",
      label: viewInfo.label ?? __("List"),
      icon: viewInfo.icon ?? "",
      route_name: router.currentRoute.value.name as string,
      order_by: listViewRef.value?.list?.params.order_by,
      filters: JSON.stringify(listViewRef.value?.list?.params.filters),
      columns: JSON.stringify(listViewRef.value?.list?.data.columns),
      rows: JSON.stringify(listViewRef.value?.list?.data?.rows),
      is_customer_portal: isCustomerPortal.value,
    };
  }

  // createView
  createView(view, (d) => {
    currentView.value = {
      label: d.label || __("List"),
      icon: getIcon(d.icon),
    };
    router.push({
      name: isCustomerPortal.value ? "TicketsCustomer" : "TicketsAgent",
      query: {
        view: d.name,
      },
    });

    handleSuccess();
  });
}

function handleSuccess(msg = __("created")) {
  toast.success(__("View {0}", [msg]));
  resetState();
}
function resetState() {
  viewDialog.show = false;
  viewDialog.view.label = "";
  viewDialog.view.icon = "";
  viewDialog.view.name = "";
  viewDialog.mode = null;
  selectedView = null;
}

// ── Feature 7: Browser notifications + sound ─────────────────────────────────
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    ctx.close();
  } catch {}
}

function showBrowserNotification(title: string, body: string) {
  playBeep();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/assets/helpdesk/desk/favicon.ico", silent: true });
  }
}

onMounted(() => {
  // Force a fresh list fetch every time this view mounts (e.g. after resolving a ticket)
  nextTick(() => listViewRef.value?.reload());

  if (!route.query.view) {
    currentView.value = {
      label: __("List"),
      icon: LucideAlignJustify,
    };
  }
  // Request browser notification permission on first mount
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  if (!isCustomerPortal.value) {
    $socket.on("helpdesk:new-ticket", () => {
      listViewRef.value?.reload();
      // Notify managers about incoming CS tickets
      if (authStore.isManager && authStore.isChatSupportMember) {
        showBrowserNotification("New Ticket", "A new ticket has arrived in Dietician Chat Support");
      }
    });
    $socket.on("helpdesk:ticket-update", () => {
      listViewRef.value?.reload();
    });
    socket.on("ticket_assigned", (data: any) => {
      listViewRef.value?.reload();
      // Notify agent when a ticket is assigned to them
      if (!authStore.isManager) {
        showBrowserNotification(
          "Ticket Assigned",
          data?.subject ? `"${data.subject}" has been assigned to you` : "A ticket has been assigned to you"
        );
      }
    });
    // Feature 4: agent status dots
    fetchAgentStatuses();
    socket.on("agent_status_changed", (data: any) => {
      if (data?.user) {
        agentStatusMap.value = { ...agentStatusMap.value, [data.user]: data.status };
      }
    });
  }
});

// Feature 5: fetch summary when view changes to a CS view
watch(showSummaryBar, (val) => {
  if (val) fetchSummary();
}, { immediate: true });

onUnmounted(() => {
  if (!isCustomerPortal.value) {
    $socket.off("helpdesk:new-ticket");
    $socket.off("helpdesk:ticket-update");
    socket.off("ticket_assigned");
    socket.off("agent_status_changed");
  }
});

usePageMeta(() => {
  return {
    title: __("Tickets"),
  };
});
</script>
