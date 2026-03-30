<template>
  <Dialog v-model="open" :options="{ title: 'Rate Ticket Quality', size: 'lg' }">
    <template #body-content>
      <div class="space-y-5 py-2">
        <p class="text-sm text-ink-gray-5">
          Rate this ticket across 4 quality dimensions (1 = Poor, 5 = Excellent)
        </p>

        <div v-for="dim in DIMENSIONS" :key="dim.key" class="space-y-1.5">
          <label class="block text-sm font-medium text-ink-gray-7">{{ dim.label }}</label>
          <div class="flex items-center gap-2">
            <button
              v-for="n in 5"
              :key="n"
              class="h-8 w-8 rounded-full text-sm font-semibold border-2 transition-all"
              :class="scores[dim.key] === n
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-outline-gray-2 text-ink-gray-5 hover:border-blue-300'"
              @click="scores[dim.key] = n"
            >{{ n }}</button>
            <span class="text-xs text-ink-gray-4 ml-1">{{ ratingLabel(scores[dim.key]) }}</span>
          </div>
        </div>

        <!-- Overall preview -->
        <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-4 py-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-ink-gray-7">Overall Score</span>
            <span class="text-xl font-bold" :class="scoreColor(overallScore)">
              {{ overallScore.toFixed(1) }} / 5
            </span>
          </div>
          <div class="mt-2 bg-surface-gray-2 rounded-full h-2 overflow-hidden">
            <div
              class="h-2 rounded-full transition-all"
              :class="scoreBarColor(overallScore)"
              :style="{ width: `${overallScore / 5 * 100}%` }"
            />
          </div>
        </div>

        <!-- Notes -->
        <div class="space-y-1">
          <label class="block text-sm font-medium text-ink-gray-7">Reviewer Notes</label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Optional coaching notes for the agent…"
            class="w-full resize-none rounded-lg border border-outline-gray-2 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
    </template>
    <template #actions>
      <Button variant="ghost" @click="open = false">Cancel</Button>
      <Button variant="solid" :loading="saving" :disabled="!allRated || saving" @click="submit">
        Save Score
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { Button, Dialog, call, toast } from "frappe-ui";
import { computed, reactive, ref, watch } from "vue";

const props = defineProps<{ ticketName: string }>();
const open = defineModel<boolean>({ default: false });

const DIMENSIONS = [
  { key: "comm_quality",        label: "Communication Quality" },
  { key: "resolution_accuracy", label: "Resolution Accuracy" },
  { key: "response_speed",      label: "Response Speed" },
  { key: "policy_adherence",    label: "Policy Adherence" },
];

const scores = reactive<Record<string, number>>({
  comm_quality: 0, resolution_accuracy: 0, response_speed: 0, policy_adherence: 0,
});
const notes = ref("");
const saving = ref(false);

const allRated = computed(() => DIMENSIONS.every(d => scores[d.key] > 0));
const overallScore = computed(() => {
  const filled = DIMENSIONS.filter(d => scores[d.key] > 0);
  if (!filled.length) return 0;
  return filled.reduce((s, d) => s + scores[d.key], 0) / filled.length;
});

// Reset on open
watch(open, (v) => {
  if (v) {
    DIMENSIONS.forEach(d => { scores[d.key] = 0; });
    notes.value = "";
  }
});

// Pre-fill if already rated
watch(open, async (v) => {
  if (!v) return;
  try {
    const existing = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.quality.get_ticket_score",
      { ticket_name: props.ticketName }
    );
    if (existing?.length) {
      const s = existing[0];
      DIMENSIONS.forEach(d => { scores[d.key] = s[d.key] || 0; });
      notes.value = s.notes || "";
    }
  } catch { /* ignore */ }
});

async function submit() {
  saving.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.quality.rate_ticket", {
      ticket_name: props.ticketName,
      scores: JSON.stringify(scores),
      notes: notes.value,
    });
    toast.create({ message: "Quality score saved", type: "success" });
    open.value = false;
  } catch {
    toast.create({ message: "Failed to save score", type: "error" });
  } finally {
    saving.value = false;
  }
}

function ratingLabel(n: number): string {
  return ["", "Poor", "Fair", "Good", "Very Good", "Excellent"][n] ?? "";
}

function scoreColor(s: number): string {
  if (!s) return "text-ink-gray-4";
  if (s >= 4) return "text-green-600";
  if (s >= 3) return "text-amber-600";
  return "text-red-600";
}

function scoreBarColor(s: number): string {
  if (s >= 4) return "bg-green-500";
  if (s >= 3) return "bg-amber-500";
  return "bg-red-500";
}
</script>
