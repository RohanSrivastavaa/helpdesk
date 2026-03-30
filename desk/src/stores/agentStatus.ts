import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { call, toast } from "frappe-ui";
import { socket } from "@/socket";

export const STATUS_OPTIONS = [
  { label: "Online", value: "Online", color: "#22c55e" },
  { label: "On Break", value: "On Break", color: "#eab308" },
  { label: "Lunch", value: "Lunch", color: "#f97316" },
  { label: "In Training", value: "In Training", color: "#3b82f6" },
  { label: "Offline", value: "Offline", color: "#9ca3af" },
];

export const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.color])
);

// How long (minutes) before a break alert fires
const BREAK_ALERT_MINUTES = 30;
const BREAK_STATUSES = ["On Break", "Lunch"];

export const useAgentStatusStore = defineStore("agentStatus", () => {
  const currentStatus = ref("Offline");
  const statusChangedAt = ref<string | null>(null); // ISO string (Feature 6)
  const isLoading = ref(false);

  // Feature 7: break alert timer handle
  let breakAlertTimer: ReturnType<typeof setTimeout> | null = null;

  // Feature 3: beforeunload cleanup ref
  let beforeUnloadRegistered = false;

  // -------------------------------------------------------------------------
  // Status fetch / set
  // -------------------------------------------------------------------------

  async function fetchStatus() {
    try {
      const result = await call(
        "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_agent_status"
      );
      if (result?.status) {
        currentStatus.value = result.status;
        statusChangedAt.value = result.last_updated ?? null;
      }
    } catch {
      // not a registered agent — silently ignore
    }
  }

  async function setStatus(status: string) {
    const previous = currentStatus.value;
    const previousChangedAt = statusChangedAt.value;
    currentStatus.value = status; // optimistic update
    statusChangedAt.value = new Date().toISOString();
    isLoading.value = true;
    try {
      const result = await call(
        "fitelo_helpdesk.fitelo_helpdesk.api.agent_status.set_agent_status",
        { status }
      );
      if (result?.status) {
        currentStatus.value = result.status;
        statusChangedAt.value = result.last_updated ?? null;
      }
    } catch {
      currentStatus.value = previous;
      statusChangedAt.value = previousChangedAt;
    } finally {
      isLoading.value = false;
    }
  }

  // -------------------------------------------------------------------------
  // Re-sync status when the tab becomes visible again (e.g. alt-tab back)
  // Status is NOT auto-set to Offline on page hide/unload — the backend
  // on_agent_logout hook handles real logouts. This prevents refresh from
  // clearing the status.
  // -------------------------------------------------------------------------

  function setupBeforeUnload() {
    if (beforeUnloadRegistered) return;
    beforeUnloadRegistered = true;
    document.addEventListener("visibilitychange", _onVisibilityChange);
  }

  function _onVisibilityChange() {
    if (document.visibilityState === "visible") {
      fetchStatus();
    }
  }

  // -------------------------------------------------------------------------
  // Feature 7: Break time alert
  // -------------------------------------------------------------------------

  function _resetBreakAlert() {
    if (breakAlertTimer) {
      clearTimeout(breakAlertTimer);
      breakAlertTimer = null;
    }
    if (BREAK_STATUSES.includes(currentStatus.value)) {
      breakAlertTimer = setTimeout(
        () => {
          toast.create({
            message: `Break reminder: you've been on "${currentStatus.value}" for ${BREAK_ALERT_MINUTES} minutes.`,
            type: "warning",
          });
        },
        BREAK_ALERT_MINUTES * 60 * 1000
      );
    }
  }

  watch(currentStatus, _resetBreakAlert);

  // -------------------------------------------------------------------------
  // Feature 1 & realtime: subscribe to own status updates
  // -------------------------------------------------------------------------

  function subscribeToUpdates() {
    socket.off("agent_status_update");
    socket.on("agent_status_update", (data: { status: string; last_updated?: string }) => {
      if (data?.status) {
        currentStatus.value = data.status;
        statusChangedAt.value = data.last_updated ?? null;
      }
    });
  }

  function unsubscribeFromUpdates() {
    socket.off("agent_status_update");
  }

  // -------------------------------------------------------------------------
  // Feature 1: global broadcast subscription (for supervisor dashboard)
  // -------------------------------------------------------------------------

  function subscribeToTeamUpdates(
    callback: (data: {
      agent: string;
      user: string;
      status: string;
      full_name: string;
      user_image: string | null;
      last_updated: string | null;
    }) => void
  ) {
    socket.off("agent_status_changed");
    socket.on("agent_status_changed", callback);
  }

  function unsubscribeFromTeamUpdates() {
    socket.off("agent_status_changed");
  }

  return {
    currentStatus,
    statusChangedAt,
    isLoading,
    fetchStatus,
    setStatus,
    setupBeforeUnload,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    subscribeToTeamUpdates,
    unsubscribeFromTeamUpdates,
  };
});
