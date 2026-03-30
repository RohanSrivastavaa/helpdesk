<template>
  <div class="relative" ref="containerRef">
    <!-- Trigger: clock icon; amber when currently snoozed -->
    <button
      class="inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-sm font-medium transition-colors focus:outline-none border"
      :class="isSnoozed
        ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
        : 'border-outline-gray-2 bg-surface-white text-ink-gray-6 hover:bg-surface-gray-1'"
      :title="isSnoozed ? `Snoozed until ${fmtSnooze}` : 'Snooze ticket'"
      @click="toggle"
    >
      <span class="text-base leading-none">💤</span>
      <span v-if="isSnoozed" class="text-xs hidden sm:block">{{ fmtSnooze }}</span>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-outline-gray-2 bg-surface-white shadow-lg"
    >
      <!-- Active snooze header -->
      <div v-if="isSnoozed" class="border-b px-3 py-2">
        <p class="text-xs text-amber-700 font-medium">⏰ Snoozed until {{ fmtSnooze }}</p>
        <button
          class="mt-1 text-xs text-red-500 hover:underline"
          :disabled="loading"
          @click="unsnooze"
        >
          {{ loading ? 'Waking up…' : 'Wake up now' }}
        </button>
      </div>

      <!-- Presets -->
      <div class="py-1">
        <p class="px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-gray-4">Snooze for…</p>
        <button
          v-for="preset in presets"
          :key="preset.label"
          class="flex w-full items-center justify-between px-3 py-2 text-sm text-ink-gray-8 hover:bg-surface-gray-1"
          :disabled="loading"
          @click="snoozePreset(preset)"
        >
          <span>{{ preset.label }}</span>
          <span class="text-xs text-ink-gray-4">{{ preset.time }}</span>
        </button>
      </div>

      <!-- Custom datetime -->
      <div class="border-t px-3 py-2">
        <p class="mb-1.5 text-xs font-medium text-ink-gray-5">Custom time</p>
        <input
          v-model="customUntil"
          type="datetime-local"
          class="w-full rounded border border-outline-gray-2 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          :min="minDatetime"
        />
        <button
          class="mt-2 w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="!customUntil || loading"
          @click="snoozeCustom"
        >
          {{ loading ? 'Snoozing…' : 'Snooze until this time' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call, toast } from "frappe-ui";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  ticketName: string;
  isSnoozed: boolean;
  snoozedUntil?: string;
}>();

const emit = defineEmits<{ (e: "change"): void }>();

const open = ref(false);
const loading = ref(false);
const customUntil = ref("");
const containerRef = ref<HTMLElement | null>(null);

const fmtSnooze = computed(() => {
  if (!props.snoozedUntil) return "";
  return new Date(props.snoozedUntil).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const minDatetime = computed(() => {
  // datetime-local min = now (ISO without seconds)
  return new Date(Date.now() + 60_000).toISOString().slice(0, 16);
});

const presets = computed(() => {
  const now = new Date();
  function fmt(d: Date) {
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  // Tomorrow 9 AM
  const tom9 = new Date(now);
  tom9.setDate(tom9.getDate() + 1);
  tom9.setHours(9, 0, 0, 0);

  // Tomorrow 2 PM
  const tom14 = new Date(now);
  tom14.setDate(tom14.getDate() + 1);
  tom14.setHours(14, 0, 0, 0);

  // Next Monday 9 AM
  const nextMon = new Date(now);
  const daysToMon = (8 - nextMon.getDay()) % 7 || 7;
  nextMon.setDate(nextMon.getDate() + daysToMon);
  nextMon.setHours(9, 0, 0, 0);

  return [
    { label: "1 hour", minutes: 60, time: fmt(in1h) },
    { label: "4 hours", minutes: 240, time: fmt(in4h) },
    { label: "Tomorrow morning", minutes: null, time: fmt(tom9), _date: tom9 },
    { label: "Tomorrow afternoon", minutes: null, time: fmt(tom14), _date: tom14 },
    { label: "Next week", minutes: null, time: fmt(nextMon), _date: nextMon },
  ];
});

function toggle() {
  open.value = !open.value;
}

function closeOnOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", closeOnOutside));
onBeforeUnmount(() => document.removeEventListener("mousedown", closeOnOutside));

async function snoozeFor(minutes: number | null, date?: Date) {
  const until = date
    ? date
    : new Date(Date.now() + (minutes ?? 0) * 60 * 1000);
  await doSnooze(until.toISOString());
}

async function snoozeCustom() {
  if (!customUntil.value) return;
  await doSnooze(new Date(customUntil.value).toISOString());
}

async function doSnooze(until: string) {
  loading.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.snooze.snooze_ticket", {
      ticket_name: props.ticketName,
      until,
    });
    open.value = false;
    toast.create({ message: "Ticket snoozed", type: "success" });
    emit("change");
  } catch {
    toast.create({ message: "Failed to snooze ticket", type: "error" });
  } finally {
    loading.value = false;
  }
}

async function unsnooze() {
  loading.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.snooze.unsnooze_ticket", {
      ticket_name: props.ticketName,
    });
    open.value = false;
    toast.create({ message: "Ticket unsnoozed", type: "info" });
    emit("change");
  } catch {
    toast.create({ message: "Failed to unsnooze", type: "error" });
  } finally {
    loading.value = false;
  }
}

// Wire preset._date to snoozeFor
function snoozePreset(preset: (typeof presets.value)[0]) {
  if (preset._date) {
    snoozeFor(null, preset._date);
  } else {
    snoozeFor(preset.minutes);
  }
}
</script>
