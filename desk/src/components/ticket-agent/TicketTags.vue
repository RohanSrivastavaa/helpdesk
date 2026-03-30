<template>
  <div class="mb-3">
    <p class="mb-1.5 text-xs font-medium text-ink-gray-5 uppercase tracking-wide">Tags</p>

    <!-- Applied tags -->
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="t in ticketTags"
        :key="t.map_name"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        :style="{ backgroundColor: t.bg, color: t.text }"
      >
        <span class="h-1.5 w-1.5 rounded-full flex-shrink-0" :style="{ backgroundColor: t.dot }" />
        {{ t.tag }}
        <button
          class="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          @click="removeTag(t.map_name)"
        >
          ×
        </button>
      </span>

      <!-- Add tag trigger -->
      <button
        ref="triggerRef"
        class="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-gray-3 px-2 py-0.5 text-xs text-ink-gray-4 hover:border-blue-400 hover:text-blue-500 transition-colors"
        @click="togglePicker"
      >
        + Add tag
      </button>
    </div>

    <!-- Tag picker dropdown -->
    <div
      v-if="showPicker"
      ref="pickerRef"
      class="absolute z-50 mt-1 w-56 rounded-lg border border-outline-gray-2 bg-surface-white shadow-xl"
    >
      <!-- Search -->
      <div class="border-b px-2 py-2">
        <input
          v-model="search"
          ref="searchInput"
          type="text"
          placeholder="Search or create tag…"
          class="w-full rounded border border-outline-gray-2 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          @keydown.enter="onEnter"
          @keydown.escape="showPicker = false"
        />
      </div>

      <!-- Tag list -->
      <div class="max-h-44 overflow-y-auto py-1">
        <button
          v-for="t in filteredAllTags"
          :key="t.name"
          class="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-surface-gray-1"
          :class="{ 'opacity-40 cursor-default': isApplied(t.name) }"
          @click="!isApplied(t.name) && applyTag(t.name)"
        >
          <span class="flex items-center gap-1.5">
            <span
              class="h-2 w-2 rounded-full flex-shrink-0"
              :style="{ backgroundColor: t.dot }"
            />
            <span :style="{ color: t.text }">{{ t.tag_name }}</span>
          </span>
          <span v-if="isApplied(t.name)" class="text-green-600">✓</span>
        </button>

        <div v-if="filteredAllTags.length === 0 && !search.trim()" class="px-3 py-2 text-xs text-ink-gray-4">
          No tags yet
        </div>
      </div>

      <!-- Create new -->
      <div v-if="search.trim() && !exactMatch" class="border-t px-3 py-2">
        <p class="mb-2 text-xs text-ink-gray-5">Create "{{ search.trim() }}"</p>
        <!-- Color picker -->
        <div class="flex flex-wrap gap-1.5 mb-2">
          <button
            v-for="(c, key) in COLORS"
            :key="key"
            class="h-5 w-5 rounded-full border-2 transition-all"
            :style="{ backgroundColor: c.dot }"
            :class="newColor === key ? 'border-ink-gray-9 scale-110' : 'border-transparent'"
            @click="newColor = key"
          />
        </div>
        <button
          class="w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          :disabled="creating"
          @click="createAndApply"
        >
          {{ creating ? 'Creating…' : 'Create & apply' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { call } from "frappe-ui";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

const props = defineProps<{ ticketName: string }>();

const COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  gray:   { bg: "#F3F4F6", text: "#374151", dot: "#6B7280" },
  red:    { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  orange: { bg: "#FFEDD5", text: "#9A3412", dot: "#F97316" },
  amber:  { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  green:  { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  teal:   { bg: "#CCFBF1", text: "#134E4A", dot: "#14B8A6" },
  blue:   { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  purple: { bg: "#EDE9FE", text: "#4C1D95", dot: "#8B5CF6" },
  pink:   { bg: "#FCE7F3", text: "#9D174D", dot: "#EC4899" },
};

interface TagInfo {
  map_name: string;
  tag: string;
  color: string;
  bg: string;
  text: string;
  dot: string;
}

interface AllTag {
  name: string;
  tag_name: string;
  color: string;
  bg: string;
  text: string;
  dot: string;
}

const ticketTags = ref<TagInfo[]>([]);
const allTags = ref<AllTag[]>([]);
const showPicker = ref(false);
const search = ref("");
const newColor = ref("blue");
const creating = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const pickerRef = ref<HTMLElement | null>(null);

const filteredAllTags = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return allTags.value;
  return allTags.value.filter((t) => t.tag_name.toLowerCase().includes(q));
});

const exactMatch = computed(() =>
  allTags.value.some(
    (t) => t.tag_name.toLowerCase() === search.value.trim().toLowerCase()
  )
);

function isApplied(tagName: string) {
  return ticketTags.value.some((t) => t.tag === tagName);
}

async function fetchTags() {
  const [ticket, all] = await Promise.all([
    call("fitelo_helpdesk.fitelo_helpdesk.api.tags.get_ticket_tags", {
      ticket_name: props.ticketName,
    }),
    call("fitelo_helpdesk.fitelo_helpdesk.api.tags.get_all_tags"),
  ]);
  ticketTags.value = ticket || [];
  allTags.value = all || [];
}

async function applyTag(tagName: string) {
  await call("fitelo_helpdesk.fitelo_helpdesk.api.tags.add_ticket_tag", {
    ticket_name: props.ticketName,
    tag_name: tagName,
  });
  await fetchTags();
  search.value = "";
}

async function removeTag(mapName: string) {
  await call("fitelo_helpdesk.fitelo_helpdesk.api.tags.remove_ticket_tag", {
    ticket_name: props.ticketName,
    map_name: mapName,
  });
  await fetchTags();
}

async function createAndApply() {
  const name = search.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.tags.create_tag", {
      tag_name: name,
      color: newColor.value,
    });
    await applyTag(name);
    showPicker.value = false;
    search.value = "";
  } finally {
    creating.value = false;
  }
}

function onEnter() {
  const q = search.value.trim();
  if (!q) return;
  const match = allTags.value.find(
    (t) => t.tag_name.toLowerCase() === q.toLowerCase()
  );
  if (match && !isApplied(match.name)) {
    applyTag(match.name);
  } else if (!exactMatch.value) {
    createAndApply();
  }
}

async function togglePicker() {
  showPicker.value = !showPicker.value;
  if (showPicker.value) {
    search.value = "";
    newColor.value = "blue";
    await nextTick();
    searchInput.value?.focus();
  }
}

function onOutsideClick(e: MouseEvent) {
  if (
    pickerRef.value &&
    !pickerRef.value.contains(e.target as Node) &&
    triggerRef.value &&
    !triggerRef.value.contains(e.target as Node)
  ) {
    showPicker.value = false;
  }
}

// Reset picker position: parent might scroll
watch(showPicker, async (v) => {
  if (v) {
    await nextTick();
    document.addEventListener("mousedown", onOutsideClick);
  } else {
    document.removeEventListener("mousedown", onOutsideClick);
  }
});

onMounted(() => {
  fetchTags();
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutsideClick);
});
</script>
