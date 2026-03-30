<template>
  <Teleport to="#app-header" v-if="showHeader">
    <slot>
      <header class="flex h-10.5 items-center justify-between mx-4 md:mr-0">
        <div class="flex items-center gap-2 max-w-[50%]">
          <slot name="left-header" />
        </div>
        <div class="flex items-center gap-2">
          <slot name="right-header" class="flex items-center gap-2" />
          <Button variant="ghost" @click="themeStore.toggleTheme()" class="!p-1.5">
            <component :is="themeStore.isDark ? SunIcon : MoonIcon" class="h-4 w-4" />
          </Button>
          <AgentStatusToggle v-if="!isCustomerPortal" />
          <CallUI :userEmail="user" />
        </div>
      </header>
    </slot>
  </Teleport>
</template>
<script setup>
import AgentStatusToggle from "@/components/AgentStatusToggle.vue";
import CallUI from "@/components/telephony/CallUI.vue";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { isCustomerPortal } from "@/utils";
import { ref, nextTick } from "vue";
import MoonIcon from "~icons/lucide/moon";
import SunIcon from "~icons/lucide/sun";

const { user } = useAuthStore();
const themeStore = useThemeStore();
const showHeader = ref(false);

nextTick(() => {
  showHeader.value = true;
});
</script>
