<template>
  <Dialog v-model="show" :options="{ title: 'Close Ticket', size: 'lg' }">
    <template #body-content>
      <div class="flex flex-col gap-5">
        <p class="text-base text-ink-gray-6">
          Select a disposition to record why this ticket is being
          <span class="font-medium text-ink-gray-9">{{ targetStatus }}</span>.
        </p>

        <!-- Quick picks -->
        <div>
          <label class="mb-2 block text-sm font-medium text-ink-gray-6">Quick Pick</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="q in quickPicks"
              :key="q.name"
              class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              :class="selectedDisposition === q.name
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-outline-gray-2 bg-white text-ink-gray-7 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'"
              @click="applyQuickPick(q)"
            >
              {{ q.label }}
            </button>
          </div>
        </div>

        <div class="border-t border-outline-gray-2" />

        <!-- Step 1: Subcategory -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-gray-6">
            Category <span class="text-red-500">*</span>
          </label>
          <select
            v-model="selectedSubcategory"
            class="w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2.5 text-base text-ink-gray-8 focus:border-orange-400 focus:outline-none"
            @change="selectedDisposition = ''"
          >
            <option value="" disabled>— Select category —</option>
            <option v-for="sub in subcategories" :key="sub" :value="sub">
              {{ sub }}
            </option>
          </select>
        </div>

        <!-- Step 2: Disposition -->
        <div v-if="selectedSubcategory">
          <label class="mb-1.5 block text-sm font-medium text-ink-gray-6">
            Disposition <span class="text-red-500">*</span>
          </label>
          <select
            v-model="selectedDisposition"
            class="w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2.5 text-base text-ink-gray-8 focus:border-orange-400 focus:outline-none"
          >
            <option value="" disabled>— Select disposition —</option>
            <option v-for="d in filteredDispositions" :key="d.name" :value="d.name">
              {{ d.title }}
            </option>
          </select>
        </div>

        <p v-if="noDispositions" class="text-sm text-red-500">
          No dispositions configured. Please add them in HD Disposition.
        </p>

        <!-- Notes -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-gray-6">
            Notes <span class="text-ink-gray-4">(optional)</span>
          </label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Any additional context about the resolution…"
            class="w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2.5 text-base text-ink-gray-8 focus:border-orange-400 focus:outline-none resize-none"
          />
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button variant="subtle" @click="cancel">Cancel</Button>
        <Button
          variant="solid"
          theme="gray"
          :disabled="!selectedDisposition"
          :loading="loading"
          @click="confirm"
        >
          Confirm
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, call, Dialog } from "frappe-ui";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  targetStatus: string;
  ticketType?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm", disposition: string, notes: string): void;
  (e: "cancel"): void;
}>();

const show = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

interface Disposition {
  name: string;
  title: string;
  subcategory?: string;
}

const quickPicks = [
  { label: "Meal Picture Review", name: "Meal picture shared",          subcategory: "Client Progress Sharing" },
  { label: "Diet Modification",   name: "Diet modification requests",   subcategory: "Diet-Related" },
  { label: "Not to be Responded", name: "Message not to be responded",  subcategory: "Messages not to be Responded" },
];

const dispositions = ref<Disposition[]>([]);
const selectedSubcategory = ref("");
const selectedDisposition = ref("");
const notes = ref("");
const loading = ref(false);

const noDispositions = computed(() => dispositions.value.length === 0);

const subcategories = computed(() => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const d of dispositions.value) {
    const sub = d.subcategory || "General";
    if (!seen.has(sub)) { seen.add(sub); result.push(sub); }
  }
  return result;
});

const filteredDispositions = computed(() =>
  dispositions.value.filter(
    (d) => (d.subcategory || "General") === selectedSubcategory.value
  )
);

function applyQuickPick(q: { label: string; name: string; subcategory: string }) {
  selectedSubcategory.value = q.subcategory;
  selectedDisposition.value = q.name;
}

async function fetchDispositions() {
  dispositions.value = [];
  selectedSubcategory.value = "";
  selectedDisposition.value = "";
  notes.value = "";
  try {
    const result = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.disposition.get_dispositions",
      props.ticketType ? { ticket_type: props.ticketType } : {}
    );
    dispositions.value = result ?? [];
  } catch {
    dispositions.value = [];
  }
}

watch(
  () => props.modelValue,
  (open) => { if (open) fetchDispositions(); },
  { immediate: true }
);

function confirm() {
  if (!selectedDisposition.value) return;
  emit("confirm", selectedDisposition.value, notes.value);
}

function cancel() {
  emit("cancel");
  show.value = false;
}
</script>
