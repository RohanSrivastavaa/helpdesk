<template>
  <Dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :options="{ title: 'Renew Fitelo CRM Token', size: 'lg' }"
  >
    <template #body-content>
      <div class="space-y-4 text-sm">
        <div class="flex items-start gap-2 p-3 rounded-lg border text-sm"
          style="background:#FFF7ED; border-color:#FED7AA; color:#92400E">
          <LucideAlertTriangle class="h-4 w-4 mt-0.5 flex-shrink-0" style="color:#F97316" />
          <p>The Fitelo CRM refresh token has expired. Follow the steps below to renew it.</p>
        </div>

        <ol class="space-y-3 text-ink-gray-7">
          <li class="flex gap-2.5">
            <span class="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background:#FF8643">1</span>
            <span>Open <strong>admin-portal.fitelo.net</strong> in a new tab and make sure you are logged in as an admin.</span>
          </li>
          <li class="flex gap-2.5">
            <span class="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background:#FF8643">2</span>
            <span>Press <kbd class="px-1.5 py-0.5 rounded text-xs border border-outline-gray-3 bg-surface-gray-1 font-mono">F12</kbd> to open DevTools, then go to the <strong>Network</strong> tab.</span>
          </li>
          <li class="flex gap-2.5">
            <span class="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background:#FF8643">3</span>
            <span>Reload the page. In the Network tab, find a request to <code class="bg-surface-gray-2 px-1 py-0.5 rounded font-mono text-xs">/auth/api/employee/refresh</code> and click it.</span>
          </li>
          <li class="flex gap-2.5">
            <span class="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background:#FF8643">4</span>
            <span>Open the <strong>Response</strong> tab, find <code class="bg-surface-gray-2 px-1 py-0.5 rounded font-mono text-xs">data.refreshToken</code>, and copy its value.</span>
          </li>
          <li class="flex gap-2.5">
            <span class="flex-shrink-0 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center" style="background:#FF8643">5</span>
            <span>Paste the token below and click <strong>Save Token</strong>.</span>
          </li>
        </ol>

        <div>
          <label class="block text-xs font-semibold text-ink-gray-6 mb-1.5 uppercase tracking-wide">New Refresh Token</label>
          <TextInput
            v-model="token"
            placeholder="Paste refresh token here…"
            class="font-mono text-xs"
          />
        </div>

        <p v-if="errorMsg" class="text-red-600 text-xs">{{ errorMsg }}</p>
        <p v-if="successMsg" class="text-green-600 text-xs font-medium">{{ successMsg }}</p>
      </div>
    </template>
    <template #actions>
      <Button
        :loading="saving"
        :disabled="!token.trim()"
        @click="save"
        class="text-white"
        style="background:#FF8643"
      >
        Save Token
      </Button>
      <Button variant="ghost" @click="$emit('update:modelValue', false)">Cancel</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { call, Dialog, TextInput, Button, toast } from "frappe-ui";
import LucideAlertTriangle from "~icons/lucide/alert-triangle";

defineProps<{ modelValue: boolean }>();
defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const token = ref("");
const saving = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

async function save() {
  if (!token.value.trim()) return;
  saving.value = true;
  errorMsg.value = "";
  successMsg.value = "";
  try {
    await call("fitelo_helpdesk.api.permissions.save_fitelo_refresh_token", {
      token: token.value.trim(),
    });
    successMsg.value = "Token saved! You can now retry opening the chat.";
    toast.success("CRM token updated successfully");
    token.value = "";
    setTimeout(() => {
      successMsg.value = "";
    }, 3000);
  } catch (e: any) {
    errorMsg.value = e?.message || "Failed to save token. Check your permissions.";
  } finally {
    saving.value = false;
  }
}
</script>
