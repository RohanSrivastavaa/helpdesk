<template>
  <div class="py-1 w-full">
    <!-- Incoming: left-aligned -->
    <div
      v-if="activity.direction === 'Incoming'"
      class="flex flex-col gap-0.5 max-w-[80%]"
    >
      <span class="text-xs text-ink-gray-4 pl-0.5">
        <WhatsAppIcon class="inline-block h-3 w-3 mr-1 text-green-500" />
        {{ activity.profile_name || activity.from }}
      </span>
      <div
        class="rounded-2xl rounded-tl-sm bg-surface-gray-2 px-3 py-2 text-sm text-ink-gray-9 whitespace-pre-wrap break-words"
      >
        <template v-if="activity.content_type === 'image' && activity.attach">
          <img :src="activity.attach" class="max-w-[200px] rounded mb-1" />
        </template>
        <template
          v-else-if="
            ['document', 'video', 'audio'].includes(activity.content_type) &&
            activity.attach
          "
        >
          <a
            :href="activity.attach"
            target="_blank"
            class="text-blue-600 underline text-xs"
          >
            📎 Attachment
          </a>
        </template>
        <span v-if="activity.message">{{ activity.message }}</span>
      </div>
      <span class="text-xs text-ink-gray-3 pl-0.5">
        {{ formatTime(activity.creation) }}
      </span>
    </div>

    <!-- Outgoing: right-aligned -->
    <div v-else class="flex flex-col gap-0.5 max-w-[80%] ml-auto items-end">
      <span class="text-xs text-ink-gray-4 pr-0.5">
        You via
        <WhatsAppIcon class="inline-block h-3 w-3 ml-0.5 text-green-500" />
      </span>
      <div
        class="rounded-2xl rounded-tr-sm bg-green-500 px-3 py-2 text-sm text-white whitespace-pre-wrap break-words"
      >
        <template v-if="activity.content_type === 'image' && activity.attach">
          <img :src="activity.attach" class="max-w-[200px] rounded mb-1" />
        </template>
        <span v-if="activity.message">{{ activity.message }}</span>
      </div>
      <span class="text-xs text-ink-gray-3 pr-0.5">
        {{ formatTime(activity.creation) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WhatsAppIcon } from "@/components/icons";

defineProps<{
  activity: {
    direction: string;
    message: string;
    from: string;
    to: string;
    profile_name: string;
    content_type: string;
    attach: string;
    creation: string;
  };
}>();

function formatTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
