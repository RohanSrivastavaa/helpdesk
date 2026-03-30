<template>
  <Dialog v-model="show" :options="{ title: '🤝 Handoff Ticket', size: 'md' }">
    <template #body-content>
      <div class="flex flex-col gap-4 py-1">
        <!-- Agent selector -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-gray-7">Hand off to</label>
          <div class="relative">
            <input
              v-model="agentSearch"
              type="text"
              placeholder="Search agent name…"
              class="w-full rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              @input="filterAgents"
              @focus="showAgentList = true"
              @blur="onAgentBlur"
            />
            <div
              v-if="showAgentList && filteredAgents.length"
              class="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded border border-outline-gray-2 bg-surface-white shadow-lg"
            >
              <button
                v-for="a in filteredAgents"
                :key="a.name"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-gray-1"
                :class="{ 'bg-blue-50 text-blue-700': selectedAgent?.name === a.name }"
                @mousedown.prevent="selectAgent(a)"
              >
                <span class="font-medium">{{ a.agent_name }}</span>
                <span class="text-xs text-ink-gray-4">{{ a.name }}</span>
              </button>
            </div>
          </div>
          <p v-if="selectedAgent" class="mt-1 text-xs text-green-700">
            ✓ {{ selectedAgent.agent_name }} selected
          </p>
        </div>

        <!-- Note content -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-gray-7">Handoff notes</label>
          <textarea
            v-model="content"
            rows="5"
            placeholder="What should the next agent know? Include context, pending actions, customer mood, last reply sent…"
            class="w-full resize-none rounded border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p class="mt-1 text-right text-xs text-ink-gray-4">{{ content.length }} chars</p>
        </div>

        <!-- Reassign toggle -->
        <label class="flex cursor-pointer items-center gap-2">
          <input v-model="reassign" type="checkbox" class="h-3.5 w-3.5 accent-blue-600" />
          <span class="text-sm text-ink-gray-7">Also reassign ticket to this agent</span>
        </label>
      </div>
    </template>
    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="show = false">Cancel</Button>
        <Button
          variant="solid"
          :disabled="!selectedAgent || !content.trim() || submitting"
          :loading="submitting"
          @click="submit"
        >
          Send Handoff
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog, call, toast } from "frappe-ui";
import { onMounted, ref, watch } from "vue";

const props = defineProps<{ ticketName: string }>();
const emit = defineEmits<{ (e: "done"): void }>();

const show = defineModel<boolean>({ default: false });

interface Agent {
  name: string;
  agent_name: string;
}

const agents = ref<Agent[]>([]);
const filteredAgents = ref<Agent[]>([]);
const agentSearch = ref("");
const selectedAgent = ref<Agent | null>(null);
const showAgentList = ref(false);
const content = ref("");
const reassign = ref(true);
const submitting = ref(false);

onMounted(async () => {
  const result = await call("fitelo_helpdesk.fitelo_helpdesk.api.handoff.get_agents");
  agents.value = result || [];
  filteredAgents.value = agents.value;
});

// Reset when re-opened
watch(show, (v) => {
  if (v) {
    agentSearch.value = "";
    selectedAgent.value = null;
    content.value = "";
    reassign.value = true;
    filteredAgents.value = agents.value;
  }
});

function filterAgents() {
  const q = agentSearch.value.toLowerCase();
  filteredAgents.value = agents.value.filter(
    (a) =>
      a.agent_name.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  );
  showAgentList.value = true;
}

function selectAgent(a: Agent) {
  selectedAgent.value = a;
  agentSearch.value = a.agent_name;
  showAgentList.value = false;
}

function onAgentBlur() {
  setTimeout(() => {
    showAgentList.value = false;
  }, 150);
}

async function submit() {
  if (!selectedAgent.value || !content.value.trim() || submitting.value) return;
  submitting.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.handoff.create_handoff_note", {
      ticket_name: props.ticketName,
      content: content.value.trim(),
      handoff_to: selectedAgent.value.name,
      reassign: reassign.value ? 1 : 0,
    });
    toast.create({
      message: `Handoff note sent to ${selectedAgent.value.agent_name}`,
      type: "success",
    });
    show.value = false;
    emit("done");
  } catch {
    toast.create({ message: "Failed to create handoff note", type: "error" });
  } finally {
    submitting.value = false;
  }
}
</script>
