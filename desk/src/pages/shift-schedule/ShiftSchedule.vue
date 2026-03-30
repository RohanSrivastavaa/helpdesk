<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">My Shift Schedule</span>
      </template>
      <template #right-header>
        <Button variant="solid" :loading="saving" :disabled="saving" @click="save">Save</Button>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-6">
      <div v-if="loading" class="flex items-center justify-center h-40 text-ink-gray-4 text-sm">
        Loading…
      </div>

      <div v-else class="mx-auto max-w-2xl space-y-6">

        <!-- Enable toggle -->
        <div class="flex items-center justify-between rounded-xl border border-outline-gray-2 p-5">
          <div>
            <p class="font-medium text-ink-gray-9">Enable shift scheduling</p>
            <p class="mt-0.5 text-sm text-ink-gray-5">
              Automatically set you Online/Offline based on your working hours
            </p>
          </div>
          <button
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="enabled ? 'bg-blue-600' : 'bg-surface-gray-3'"
            role="switch"
            :aria-checked="enabled"
            @click="enabled = !enabled"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
              :class="enabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <!-- Weekly schedule grid -->
        <template v-if="enabled">
          <div class="rounded-xl border border-outline-gray-2 overflow-hidden">
            <div class="px-5 py-3 border-b bg-surface-gray-1">
              <h3 class="text-sm font-semibold text-ink-gray-7">Working Hours</h3>
            </div>
            <div class="divide-y">
              <div
                v-for="day in DAYS"
                :key="day.key"
                class="flex items-center gap-4 px-5 py-3"
              >
                <!-- Day toggle -->
                <button
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                  :class="schedule[day.key]?.enabled ? 'bg-blue-600' : 'bg-surface-gray-3'"
                  @click="schedule[day.key].enabled = !schedule[day.key].enabled"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                    :class="schedule[day.key]?.enabled ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>

                <!-- Day label -->
                <span
                  class="w-10 text-sm font-medium"
                  :class="schedule[day.key]?.enabled ? 'text-ink-gray-8' : 'text-ink-gray-4'"
                >
                  {{ day.label }}
                </span>

                <template v-if="schedule[day.key]?.enabled">
                  <input
                    v-model="schedule[day.key].start"
                    type="time"
                    class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-blue-400"
                  />
                  <span class="text-ink-gray-4 text-sm">to</span>
                  <input
                    v-model="schedule[day.key].end"
                    type="time"
                    class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-blue-400"
                  />
                  <span class="text-xs text-ink-gray-4">
                    {{ hoursLabel(schedule[day.key].start, schedule[day.key].end) }}
                  </span>
                </template>
                <span v-else class="text-sm text-ink-gray-4 italic">Day off</span>
              </div>
            </div>
          </div>

          <!-- Info card -->
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p class="font-medium mb-1">How it works</p>
            <ul class="list-disc list-inside space-y-0.5 text-blue-700 text-xs">
              <li>System checks every 5 minutes and sets your status automatically</li>
              <li>During working hours → Online; Outside or day off → Offline</li>
              <li>You can still manually override your status at any time</li>
              <li>Tickets won't be auto-assigned to you when Offline</li>
            </ul>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call, toast } from "frappe-ui";
import { onMounted, reactive, ref } from "vue";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

type DaySchedule = { enabled: boolean; start: string; end: string };
type Schedule = Record<string, DaySchedule>;

const loading = ref(true);
const saving = ref(false);
const enabled = ref(false);
const schedule = reactive<Schedule>({
  mon: { enabled: true,  start: "09:00", end: "18:00" },
  tue: { enabled: true,  start: "09:00", end: "18:00" },
  wed: { enabled: true,  start: "09:00", end: "18:00" },
  thu: { enabled: true,  start: "09:00", end: "18:00" },
  fri: { enabled: true,  start: "09:00", end: "18:00" },
  sat: { enabled: false, start: "09:00", end: "18:00" },
  sun: { enabled: false, start: "09:00", end: "18:00" },
});

async function load() {
  loading.value = true;
  try {
    const result = await call("fitelo_helpdesk.fitelo_helpdesk.api.shift.get_my_shift");
    if (result) {
      enabled.value = !!result.enabled;
      const s: Schedule = result.schedule || {};
      for (const key of Object.keys(s)) {
        if (schedule[key]) {
          schedule[key].enabled = !!s[key].enabled;
          schedule[key].start   = s[key].start || "09:00";
          schedule[key].end     = s[key].end   || "18:00";
        }
      }
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.shift.save_shift", {
      enabled: enabled.value ? 1 : 0,
      schedule_json: JSON.stringify(schedule),
    });
    toast.create({ message: "Shift schedule saved", type: "success" });
  } catch {
    toast.create({ message: "Failed to save", type: "error" });
  } finally {
    saving.value = false;
  }
}

function hoursLabel(start: string, end: string): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

onMounted(load);
</script>
