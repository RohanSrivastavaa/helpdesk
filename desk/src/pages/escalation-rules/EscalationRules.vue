<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">Escalation Rules</span>
      </template>
      <template #right-header>
        <Button variant="solid" @click="openDialog()">+ Add Rule</Button>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

      <!-- Info banner -->
      <div class="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <span class="text-base shrink-0">ℹ️</span>
        <span>
          Rules run every 30 minutes. A ticket is escalated when there has been
          <strong>no agent reply</strong> for the specified time after the customer's last message.
          Each ticket is escalated at most once per rule window.
        </span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-32 text-ink-gray-4 text-sm">
        Loading…
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!rules.length"
        class="flex flex-col items-center justify-center h-48 gap-3 text-ink-gray-4"
      >
        <FeatherIcon name="alert-circle" class="h-10 w-10" />
        <p class="text-sm font-medium">No escalation rules yet</p>
        <Button variant="outline" @click="openDialog()">Add your first rule</Button>
      </div>

      <!-- Rule cards -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="rule in rules"
          :key="rule.name"
          class="rounded-xl border bg-surface-white p-4 flex items-center gap-4"
          :class="rule.enabled ? '' : 'opacity-60'"
        >
          <!-- Enable toggle -->
          <button
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            :class="rule.enabled ? 'bg-blue-500' : 'bg-surface-gray-3'"
            @click="toggleRule(rule)"
          >
            <span
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
              :class="rule.enabled ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>

          <!-- Time badge -->
          <div
            class="flex items-center justify-center rounded-lg px-3 py-2 shrink-0 min-w-[4.5rem]"
            :class="timeClass(rule.hours_without_response)"
          >
            <span class="text-sm font-bold leading-none">{{ fmtHours(rule.hours_without_response) }}</span>
          </div>

          <!-- Rule info -->
          <div class="flex-1 min-w-0">
            <p class="font-medium text-ink-gray-9 truncate">{{ rule.rule_name }}</p>
            <p class="text-xs text-ink-gray-5 mt-0.5">
              No response for <strong>{{ fmtHours(rule.hours_without_response) }}</strong>
              → <span class="capitalize font-medium" :class="actionColor(rule.action)">{{ actionLabel(rule.action) }}</span>
              <span v-if="rule.action === 'bump_priority' && rule.new_priority">
                to <strong>{{ rule.new_priority }}</strong>
              </span>
              <span v-if="rule.action === 'notify_manager' && rule.notify_email">
                → <strong>{{ rule.notify_email }}</strong>
              </span>
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="p-1.5 rounded hover:bg-surface-gray-2 text-ink-gray-5 hover:text-ink-gray-8 transition-colors"
              title="Edit"
              @click="openDialog(rule)"
            >
              <FeatherIcon name="edit-2" class="h-3.5 w-3.5" />
            </button>
            <button
              class="p-1.5 rounded hover:bg-red-50 text-ink-gray-5 hover:text-red-600 transition-colors"
              title="Delete"
              @click="deleteRule(rule)"
            >
              <FeatherIcon name="trash-2" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Add / Edit dialog ──────────────────────────────────────── -->
    <Dialog v-model="showDialog" :options="{ title: editingRule?.name ? 'Edit Rule' : 'Add Rule' }">
      <template #body-content>
        <div class="flex flex-col gap-4 py-2">

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-ink-gray-7">Rule Name</label>
            <input
              v-model="form.rule_name"
              type="text"
              placeholder="e.g. 4-hour SLA warning"
              class="rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-outline-gray-4"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-ink-gray-7">Hours Without Response</label>
            <input
              v-model.number="form.hours_without_response"
              type="number"
              min="0.5"
              step="0.5"
              class="rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-outline-gray-4"
            />
            <p class="text-xs text-ink-gray-4">Escalate if no agent reply within this many hours</p>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-ink-gray-7">Action</label>
            <select
              v-model="form.action"
              class="rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-outline-gray-4 bg-white"
            >
              <option v-for="a in actionOptions" :key="a.value" :value="a.value">
                {{ a.label }}
              </option>
            </select>
          </div>

          <div v-if="form.action === 'bump_priority'" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-ink-gray-7">Set Priority To</label>
            <select
              v-model="form.new_priority"
              class="rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-outline-gray-4 bg-white"
            >
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div v-if="form.action === 'notify_manager'" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-ink-gray-7">Manager Email</label>
            <input
              v-model="form.notify_email"
              type="email"
              placeholder="manager@example.com"
              class="rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-outline-gray-4"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.enabled" class="h-4 w-4 accent-blue-500 rounded" />
            <span class="text-sm text-ink-gray-7">Enabled</span>
          </label>

          <p v-if="formError" class="text-xs text-red-500">{{ formError }}</p>
        </div>
      </template>
      <template #actions>
        <Button variant="outline" @click="showDialog = false">Cancel</Button>
        <Button variant="solid" :loading="saving" @click="saveRule">Save</Button>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call, Dialog, FeatherIcon } from "frappe-ui";
import { onMounted, reactive, ref } from "vue";

// ── Types ──────────────────────────────────────────────────────────────────
interface Rule {
  name: string;
  rule_name: string;
  enabled: boolean | number;
  hours_without_response: number;
  action: string;
  new_priority: string;
  notify_email: string;
}

// ── Data ───────────────────────────────────────────────────────────────────
const rules   = ref<Rule[]>([]);
const loading = ref(false);

async function loadRules() {
  loading.value = true;
  try {
    rules.value = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.escalation.get_rules"
    ) ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadRules);

// ── Dialog ─────────────────────────────────────────────────────────────────
const showDialog  = ref(false);
const saving      = ref(false);
const formError   = ref("");
const editingRule = ref<Rule | null>(null);

const form = reactive({
  rule_name: "",
  hours_without_response: 4,
  action: "notify_agent",
  new_priority: "High",
  notify_email: "",
  enabled: true,
});

function openDialog(rule?: Rule) {
  editingRule.value  = rule ?? null;
  formError.value    = "";
  form.rule_name     = rule?.rule_name ?? "";
  form.hours_without_response = rule?.hours_without_response ?? 4;
  form.action        = rule?.action ?? "notify_agent";
  form.new_priority  = rule?.new_priority ?? "High";
  form.notify_email  = rule?.notify_email ?? "";
  form.enabled       = rule ? !!rule.enabled : true;
  showDialog.value   = true;
}

async function saveRule() {
  formError.value = "";
  if (!form.rule_name.trim()) {
    formError.value = "Rule name is required.";
    return;
  }
  if (!form.hours_without_response || form.hours_without_response < 0.5) {
    formError.value = "Hours must be at least 0.5.";
    return;
  }

  saving.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.escalation.save_rule",
      {
        name:                   editingRule.value?.name ?? null,
        rule_name:              form.rule_name,
        hours_without_response: form.hours_without_response,
        action:                 form.action,
        new_priority:           form.new_priority,
        notify_email:           form.notify_email,
        enabled:                form.enabled ? 1 : 0,
      }
    );
    showDialog.value = false;
    loadRules();
  } finally {
    saving.value = false;
  }
}

async function deleteRule(rule: Rule) {
  if (!confirm(`Delete rule "${rule.rule_name}"?`)) return;
  await call(
    "fitelo_helpdesk.fitelo_helpdesk.api.escalation.delete_rule",
    { name: rule.name }
  );
  loadRules();
}

async function toggleRule(rule: Rule) {
  const newVal = rule.enabled ? 0 : 1;
  await call(
    "fitelo_helpdesk.fitelo_helpdesk.api.escalation.toggle_rule",
    { name: rule.name, enabled: newVal }
  );
  rule.enabled = newVal;
}

// ── Options & formatters ───────────────────────────────────────────────────
const actionOptions = [
  { value: "notify_agent",   label: "Notify assigned agent" },
  { value: "reassign",       label: "Reassign to another agent" },
  { value: "bump_priority",  label: "Bump ticket priority" },
  { value: "notify_manager", label: "Email manager" },
];

function actionLabel(action: string): string {
  return actionOptions.find(a => a.value === action)?.label ?? action;
}

function actionColor(action: string): string {
  return ({
    notify_agent:   "text-blue-600",
    reassign:       "text-violet-600",
    bump_priority:  "text-orange-600",
    notify_manager: "text-red-600",
  } as Record<string, string>)[action] ?? "text-ink-gray-6";
}

function fmtHours(h: number): string {
  if (h < 1) return `${h * 60}m`;
  if (h === 1) return "1h";
  if (Number.isInteger(h)) return `${h}h`;
  return `${h}h`;
}

function timeClass(h: number): string {
  if (h <= 2)  return "bg-green-100 text-green-700";
  if (h <= 8)  return "bg-amber-100 text-amber-700";
  if (h <= 24) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}
</script>
