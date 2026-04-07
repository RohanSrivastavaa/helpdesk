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

// Single shared AudioContext — avoids browser limit on concurrent contexts
let _audioCtx: AudioContext | null = null;
let _nextChimeAt = 0; // Web Audio clock time when the next chime may start
const CHIME_DURATION = 0.72; // seconds per chime
const MAX_QUEUED_CHIMES = 3; // don't stack more than this many

function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();
    _nextChimeAt = 0;
  }
  return _audioCtx;
}

async function playAssignedChime() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") await ctx.resume();

    const now = ctx.currentTime;
    // If the queue is already full, skip (don't stack infinitely)
    if (_nextChimeAt - now >= CHIME_DURATION * MAX_QUEUED_CHIMES) return;

    const startAt = Math.max(now, _nextChimeAt);
    _nextChimeAt = startAt + CHIME_DURATION;

    // Two-note rising chime: C5 → E5, louder
    ([[ 523, 0 ], [ 659, 0.2 ]] as [number, number][]).forEach(([freq, offset]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = startAt + offset;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {}
}

function onTicketAssigned(data?: { ticket?: string; subject?: string }) {
  playAssignedChime();
  if ("Notification" in window && (window.Notification as any).permission === "granted") {
    new (window.Notification as any)("Ticket Assigned", {
      body: data?.subject ? `"${data.subject}" has been assigned to you` : "A new ticket has been assigned to you",
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
