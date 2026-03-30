<template>
  <div class="border-b">
    <div id="app-header" class="w-full"></div>
  </div>
</template>

<script setup>
import { useTelephonyStore } from "@/stores/telephony";
import { onMounted } from "vue";

const telephonyStore = useTelephonyStore();

onMounted(() => {
  telephonyStore.fetchCallIntegrationStatus();
});
</script>
