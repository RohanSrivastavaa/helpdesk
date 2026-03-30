<template>
  <Dialog v-model="show" :options="{ title: '📱 Send via WhatsApp', size: 'md' }">
    <template #body-content>
      <div class="flex flex-col gap-4 py-1">

        <!-- Phone number -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-ink-gray-6">Phone Number <span class="text-red-500">*</span></label>
          <input
            v-model="phone"
            type="tel"
            placeholder="e.g. 919876543210 (with country code, no +)"
            class="w-full rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <p class="text-xs text-ink-gray-4">Enter full number with country code, no spaces or +</p>
        </div>

        <!-- Template / Message -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-ink-gray-6">Message <span class="text-red-500">*</span></label>
            <button
              v-if="savedReplies.length"
              class="text-xs text-blue-600 hover:underline"
              @click="showTemplates = !showTemplates"
            >
              {{ showTemplates ? 'Hide templates' : 'Use template ▾' }}
            </button>
          </div>

          <!-- Template picker -->
          <div
            v-if="showTemplates"
            class="max-h-40 overflow-y-auto rounded-lg border border-outline-gray-2 divide-y divide-outline-gray-1"
          >
            <button
              v-for="r in savedReplies"
              :key="r.name"
              class="w-full text-left px-3 py-2 hover:bg-surface-gray-1 transition-colors"
              @click="selectTemplate(r)"
            >
              <p class="text-sm font-medium text-ink-gray-9">{{ r.title }}</p>
              <p class="text-xs text-ink-gray-4 truncate">{{ r.preview }}</p>
            </button>
          </div>

          <textarea
            v-model="message"
            rows="4"
            placeholder="Type your message…"
            class="w-full resize-none rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        <!-- Note about outbound -->
        <p class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Outbound messages to new numbers require a pre-approved WhatsApp template. Plain text works within 24h of prior contact.
        </p>
      </div>
    </template>
    <template #actions>
      <Button variant="solid" :loading="sending" :disabled="!canSend" @click="send">
        Send WhatsApp
      </Button>
      <Button @click="show = false">Cancel</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog, call, toast } from "frappe-ui";
import { computed, onMounted, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  ticketName: string;
  contactPhone?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
  (e: "sent"): void;
}>();

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const phone = ref("");
const message = ref("");
const sending = ref(false);
const showTemplates = ref(false);

interface SavedReply { name: string; title: string; message: string; preview: string }
const savedReplies = ref<SavedReply[]>([]);

const canSend = computed(() => phone.value.trim().length >= 7 && message.value.trim().length > 0 && !sending.value);

watch(() => props.modelValue, (v) => {
  if (v) {
    phone.value = (props.contactPhone || "").replace(/\D/g, "");
    message.value = "";
    showTemplates.value = false;
  }
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function selectTemplate(r: SavedReply) {
  message.value = stripHtml(r.message);
  showTemplates.value = false;
}

async function send() {
  if (!canSend.value) return;
  sending.value = true;
  try {
    await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.whatsapp.initiate_whatsapp_conversation",
      {
        ticket_name: props.ticketName,
        phone_number: phone.value.trim(),
        message: message.value.trim(),
      }
    );
    toast.create({ message: "WhatsApp message sent", type: "success" });
    show.value = false;
    emit("sent");
  } catch (e: any) {
    toast.create({ message: e?.message || "Failed to send", type: "error" });
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  try {
    const result = await call("frappe.client.get_list", {
      doctype: "HD Saved Reply",
      fields: ["name", "title", "message"],
      limit: 100,
    });
    savedReplies.value = (result ?? []).map((r: any) => ({
      ...r,
      preview: stripHtml(r.message).slice(0, 80),
    }));
  } catch { /* ignore */ }
});
</script>
