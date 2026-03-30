<template>
  <Resizer class="flex flex-col justify-between border-l" side="right">
    <TabButtons
      :buttons="tabs"
      v-model="currentTab"
      class="tab-buttons mb-1 px-5 mt-3.5"
    />
    <div class="flex-1 max-h-full overflow-hidden">
      <TicketDetailsTab v-if="currentTab === 'details'" />
      <TicketContactTab v-else-if="currentTab === 'contact'" />
      <Customer360Tab v-else-if="currentTab === '360'" />
      <TicketHistoryTab v-else />
    </div>
  </Resizer>
</template>

<script setup lang="ts">
import { TabButtons } from "frappe-ui";
import { ref } from "vue";
import Resizer from "../Resizer.vue";
import TicketContactTab from "./TicketContactTab.vue";
import TicketDetailsTab from "./TicketDetailsTab.vue";
import TicketHistoryTab from "./TicketHistoryTab.vue";
import Customer360Tab from "./Customer360Tab.vue";

const currentTab = ref("details");
const tabs = [
  { label: "Details", value: "details" },
  { label: "Contact", value: "contact" },
  { label: "360°", value: "360" },
  { label: "History", value: "history" },
];
</script>

<style>
.tab-buttons div,
.tab-buttons button {
  width: 100%;
  flex: 1;
}
</style>
