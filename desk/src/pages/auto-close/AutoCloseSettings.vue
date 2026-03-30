<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-white">
    <!-- Header -->
    <div class="flex items-center justify-between border-b px-6 py-4">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">Auto-Close Inactive Tickets</h1>
        <p class="mt-0.5 text-sm text-ink-gray-5">
          Automatically close tickets with no activity after a set number of days
        </p>
      </div>
      <button
        class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? "Saving…" : "Save" }}
      </button>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <span class="text-sm text-ink-gray-4">Loading…</span>
    </div>

    <div v-else class="flex-1 overflow-y-auto px-6 py-6">
      <div class="mx-auto max-w-xl space-y-8">

        <!-- Enable toggle -->
        <div class="flex items-center justify-between rounded-xl border border-outline-gray-2 p-5">
          <div>
            <p class="font-medium text-ink-gray-9">Enable auto-close</p>
            <p class="mt-0.5 text-sm text-ink-gray-5">
              Runs every 6 hours. Snoozed tickets are never auto-closed.
            </p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="config.enabled ? 'bg-blue-600' : 'bg-surface-gray-3'"
            role="switch"
            :aria-checked="config.enabled"
            @click="config.enabled = !config.enabled"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
              :class="config.enabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <template v-if="config.enabled">
          <!-- Inactivity threshold -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-ink-gray-7">
              Close after <span class="font-bold text-ink-gray-9">{{ config.inactive_days }}</span> days of inactivity
            </label>
            <input
              v-model.number="config.inactive_days"
              type="range"
              min="1"
              max="30"
              step="1"
              class="w-full accent-blue-600"
            />
            <div class="flex justify-between text-xs text-ink-gray-4">
              <span>1 day</span>
              <span>30 days</span>
            </div>
            <p class="text-xs text-ink-gray-5">
              Activity = last email communication, WhatsApp message, or ticket modification.
            </p>
          </div>

          <!-- Preview -->
          <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-gray-5">Preview</p>
            <div class="flex items-center gap-2 text-sm text-ink-gray-7">
              <span class="text-lg">🕐</span>
              <span>
                Tickets with no activity for <strong>{{ config.inactive_days }} day{{ config.inactive_days !== 1 ? 's' : '' }}</strong>
                will be closed automatically.
              </span>
            </div>
            <div class="mt-2 flex items-center gap-2 text-sm text-ink-gray-5">
              <span>Runs:</span>
              <span class="font-mono text-xs bg-surface-gray-2 px-1.5 py-0.5 rounded">every 6 hours</span>
            </div>
          </div>

          <!-- WA notification -->
          <div class="space-y-4 rounded-xl border border-outline-gray-2 p-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-ink-gray-9">WhatsApp notification on close</p>
                <p class="mt-0.5 text-sm text-ink-gray-5">
                  Send a message when a WA-linked ticket is auto-closed
                </p>
              </div>
              <button
                class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                :class="config.send_wa_notification ? 'bg-green-500' : 'bg-surface-gray-3'"
                @click="config.send_wa_notification = !config.send_wa_notification"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="config.send_wa_notification ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>

            <div v-if="config.send_wa_notification">
              <label class="mb-1.5 block text-sm font-medium text-ink-gray-7">
                Message template
              </label>
              <textarea
                v-model="config.wa_close_message"
                rows="4"
                class="w-full resize-none rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p class="mt-1 text-xs text-ink-gray-4">
                Variables: <code class="bg-surface-gray-2 px-1 rounded">{ticket_id}</code>
                <code class="bg-surface-gray-2 px-1 rounded ml-1">{days}</code>
              </p>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call, toast } from "frappe-ui";
import { onMounted, reactive, ref } from "vue";

const loading = ref(true);
const saving = ref(false);

const config = reactive({
  enabled: false,
  inactive_days: 7,
  send_wa_notification: true,
  wa_close_message:
    "Hi! Your support ticket #{ticket_id} has been closed due to inactivity ({days} days). Reply anytime to open a new ticket. Thank you! 🙏",
});

async function fetchConfig() {
  loading.value = true;
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.auto_close.get_config"
    );
    if (result) {
      config.enabled = !!result.enabled;
      config.inactive_days = result.inactive_days || 7;
      config.send_wa_notification = result.send_wa_notification !== 0;
      config.wa_close_message = result.wa_close_message || config.wa_close_message;
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.auto_close.save_config", {
      enabled: config.enabled ? 1 : 0,
      inactive_days: config.inactive_days,
      send_wa_notification: config.send_wa_notification ? 1 : 0,
      wa_close_message: config.wa_close_message,
    });
    toast.create({ message: "Settings saved", type: "success" });
  } catch {
    toast.create({ message: "Failed to save", type: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  fetchConfig();
});
</script>
