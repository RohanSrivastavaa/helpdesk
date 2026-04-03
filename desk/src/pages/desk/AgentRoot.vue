<template>
  <Layout>
    <router-view class="flex flex-1 flex-col overflow-hidden" />
  </Layout>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { socket } from "@/socket";
import { computed, defineAsyncComponent, onMounted, onUnmounted, onBeforeMount } from "vue";
import { useRouter } from "vue-router";

import { useScreenSize } from "@/composables/screen";
const router = useRouter();
const authStore = useAuthStore();

const { isMobileView } = useScreenSize();

const MobileLayout = defineAsyncComponent(
  () => import("@/components/layouts/MobileLayout.vue")
);
const DesktopLayout = defineAsyncComponent(
  () => import("@/components/layouts/DesktopLayout.vue")
);

const Layout = computed(() => {
  if (isMobileView.value) {
    return MobileLayout;
  } else {
    return DesktopLayout;
  }
});

onBeforeMount(() => {
  if (!authStore.hasDeskAccess) {
    router.replace({ name: "TicketsCustomer" });
  }
});

function playAssignedChime() {
  try {
    const ctx = new AudioContext();
    // Two-note rising chime: C5 → E5
    [[523, 0], [659, 0.18]].forEach(([freq, delay]: [number, number]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.45);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

function onTicketAssigned() {
  playAssignedChime();
  if ("Notification" in window && (window.Notification as any).permission === "granted") {
    new (window.Notification as any)("Ticket Assigned", {
      body: "A new ticket has been assigned to you",
      icon: "/assets/helpdesk/desk/favicon.ico",
      silent: true,
    });
  }
}

onMounted(() => {
  socket.on("ticket_assigned", onTicketAssigned);
});

onUnmounted(() => {
  socket.off("ticket_assigned", onTicketAssigned);
});
</script>
