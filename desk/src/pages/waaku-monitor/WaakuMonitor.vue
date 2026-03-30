<template>
  <div class="flex flex-col h-full overflow-auto bg-surface-gray-1">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-outline-gray-2 shrink-0">
      <div>
        <h1 class="text-lg font-semibold text-ink-gray-9">Waaku Sessions</h1>
        <p class="text-sm text-ink-gray-5 mt-0.5">Manage backup WhatsApp numbers</p>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="text-xs px-2 py-0.5 rounded-full font-medium"
          :class="overallHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
        >
          {{ overallHealthy ? 'All healthy' : 'Issues detected' }}
        </span>
        <button
          class="text-sm px-3 py-1.5 rounded border border-outline-gray-2 text-ink-gray-7 hover:bg-surface-gray-2 flex items-center gap-1.5"
          :disabled="refreshing"
          @click="refresh"
        >
          <span :class="refreshing ? 'animate-spin' : ''">↻</span>
          Refresh
        </button>
        <button
          class="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
          @click="showCreate = true"
        >
          + New Session
        </button>
        <button
          class="text-sm px-3 py-1.5 rounded border border-outline-gray-2 text-ink-gray-7 hover:bg-surface-gray-2"
          @click="showSettings = !showSettings"
        >
          ⚙ Settings
        </button>
      </div>
    </div>

    <!-- Settings panel -->
    <div
      v-if="showSettings"
      class="mx-6 mt-4 p-4 bg-white rounded-lg border border-outline-gray-2 shadow-sm"
    >
      <h2 class="text-sm font-semibold text-ink-gray-8 mb-3">Waaku Connection Settings</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-ink-gray-5 mb-1">Enabled</label>
          <input v-model="settings.enabled" type="checkbox" class="rounded" />
        </div>
        <div>
          <label class="block text-xs text-ink-gray-5 mb-1">Base URL</label>
          <input
            v-model="settings.base_url"
            type="text"
            placeholder="http://localhost:4300"
            class="w-full text-sm px-3 py-1.5 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label class="block text-xs text-ink-gray-5 mb-1">API Key</label>
          <input
            v-model="settings.api_key"
            type="password"
            placeholder="••••••••"
            class="w-full text-sm px-3 py-1.5 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label class="block text-xs text-ink-gray-5 mb-1">Webhook Secret (optional)</label>
          <input
            v-model="settings.webhook_secret"
            type="password"
            placeholder="••••••••"
            class="w-full text-sm px-3 py-1.5 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <button
          class="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          :disabled="savingSettings"
          @click="saveSettings"
        >
          {{ savingSettings ? 'Saving…' : 'Save Settings' }}
        </button>
        <p class="text-xs text-ink-gray-5">
          Webhook URL:
          <code class="bg-surface-gray-2 px-1 rounded text-xs">
            /api/method/fitelo_helpdesk.fitelo_helpdesk.api.waaku.webhook
          </code>
        </p>
      </div>
    </div>

    <!-- Health summary -->
    <div v-if="health" class="grid grid-cols-4 gap-4 mx-6 mt-4 shrink-0">
      <div class="bg-white rounded-lg border border-outline-gray-2 p-4">
        <p class="text-xs text-ink-gray-5 mb-1">Total</p>
        <p class="text-2xl font-bold text-ink-gray-9">{{ health.summary?.total ?? '–' }}</p>
      </div>
      <div class="bg-white rounded-lg border border-outline-gray-2 p-4">
        <p class="text-xs text-ink-gray-5 mb-1">Ready</p>
        <p class="text-2xl font-bold text-green-600">{{ health.summary?.ready ?? '–' }}</p>
      </div>
      <div class="bg-white rounded-lg border border-outline-gray-2 p-4">
        <p class="text-xs text-ink-gray-5 mb-1">Stale</p>
        <p class="text-2xl font-bold text-amber-500">{{ health.summary?.stale ?? '–' }}</p>
      </div>
      <div class="bg-white rounded-lg border border-outline-gray-2 p-4">
        <p class="text-xs text-ink-gray-5 mb-1">Unhealthy</p>
        <p class="text-2xl font-bold text-red-500">{{ health.summary?.unhealthy ?? '–' }}</p>
      </div>
    </div>

    <!-- Session list -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mx-6 mt-4 mb-6">
      <div
        v-for="s in mergedSessions"
        :key="s.id"
        class="bg-white rounded-lg border shadow-sm overflow-hidden"
        :class="s.healthy === false ? 'border-red-200' : s.status === 'ready' ? 'border-green-200' : 'border-outline-gray-2'"
      >
        <!-- Session header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-outline-gray-2">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="statusDot(s.status)"
            />
            <div>
              <p class="text-sm font-semibold text-ink-gray-8">
                {{ s.record?.label || s.id }}
              </p>
              <p class="text-xs text-ink-gray-5">{{ s.id }}</p>
            </div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
            :class="statusBadge(s.status)"
          >
            {{ s.status || 'unknown' }}
          </span>
        </div>

        <!-- Session info -->
        <div class="px-4 py-3 space-y-1 text-xs text-ink-gray-6">
          <div v-if="s.record?.phone_number" class="flex justify-between">
            <span>Phone</span>
            <span class="font-medium text-ink-gray-8">{{ s.record.phone_number }}</span>
          </div>
          <div v-if="s.record?.assigned_agent" class="flex justify-between">
            <span>Agent</span>
            <span class="font-medium text-ink-gray-8">{{ s.record.assigned_agent }}</span>
          </div>
          <div class="flex justify-between">
            <span>Uptime</span>
            <span>{{ fmtUptime(s.uptime) }}</span>
          </div>
          <div class="flex justify-between">
            <span>Last activity</span>
            <span>{{ s.timeSinceLastActivity != null ? s.timeSinceLastActivity + 's ago' : '–' }}</span>
          </div>
        </div>

        <!-- QR code (shown when waiting for scan) -->
        <div
          v-if="s.status === 'qr_received' && qrCodes[s.id]"
          class="flex flex-col items-center px-4 pb-4 gap-2"
        >
          <p class="text-xs text-amber-600 font-medium">Scan with WhatsApp to connect</p>
          <img :src="qrCodes[s.id]" alt="QR Code" class="w-40 h-40 rounded border border-outline-gray-2" />
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 px-4 pb-3">
          <button
            v-if="s.status === 'qr_received'"
            class="text-xs px-2.5 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
            @click="fetchQr(s.id)"
          >
            Refresh QR
          </button>
          <button
            class="text-xs px-2.5 py-1 rounded border border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2"
            :disabled="actionLoading[s.id]"
            @click="restartSession(s.id)"
          >
            Restart
          </button>
          <button
            class="text-xs px-2.5 py-1 rounded border border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2"
            @click="openEdit(s)"
          >
            Edit
          </button>
          <button
            class="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 ml-auto"
            :disabled="actionLoading[s.id]"
            @click="confirmDelete(s.id)"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Registered sessions not yet active in Waaku -->
      <div
        v-for="r in offlineSessions"
        :key="r.session_id"
        class="bg-white rounded-lg border border-outline-gray-2 shadow-sm overflow-hidden opacity-60"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-outline-gray-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            <div>
              <p class="text-sm font-semibold text-ink-gray-8">{{ r.label || r.session_id }}</p>
              <p class="text-xs text-ink-gray-5">{{ r.session_id }}</p>
            </div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">offline</span>
        </div>
        <div class="px-4 py-3 text-xs text-ink-gray-5">Not active in Waaku</div>
        <div class="flex gap-2 px-4 pb-3">
          <button
            class="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            :disabled="actionLoading[r.session_id]"
            @click="startSession(r.session_id)"
          >
            Start
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!mergedSessions.length && !offlineSessions.length"
        class="col-span-3 flex flex-col items-center justify-center py-16 text-ink-gray-4"
      >
        <p class="text-4xl mb-3">📱</p>
        <p class="font-medium">No sessions yet</p>
        <p class="text-sm mt-1">Create a session and scan the QR code to connect a WhatsApp number.</p>
      </div>
    </div>

    <!-- Create session dialog -->
    <div
      v-if="showCreate"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="showCreate = false"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 class="text-base font-semibold text-ink-gray-9 mb-4">Create New Session</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Session ID <span class="text-red-500">*</span></label>
            <input
              v-model="newSession.id"
              type="text"
              placeholder="backup-1"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Label</label>
            <input
              v-model="newSession.label"
              type="text"
              placeholder="Backup Line 1"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Assigned Agent</label>
            <input
              v-model="newSession.agent"
              type="text"
              placeholder="agent@example.com"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-5">
          <button
            class="flex-1 text-sm px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            :disabled="creating"
            @click="createSession"
          >
            {{ creating ? 'Creating…' : 'Create & Connect' }}
          </button>
          <button
            class="flex-1 text-sm px-3 py-2 rounded border border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2"
            @click="showCreate = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Edit session dialog -->
    <div
      v-if="editSession"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="editSession = null"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 class="text-base font-semibold text-ink-gray-9 mb-4">Edit Session — {{ editSession.id }}</h2>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Label</label>
            <input
              v-model="editSession.label"
              type="text"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Phone Number</label>
            <input
              v-model="editSession.phone"
              type="text"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label class="block text-xs text-ink-gray-5 mb-1">Assigned Agent</label>
            <input
              v-model="editSession.agent"
              type="text"
              class="w-full text-sm px-3 py-2 border border-outline-gray-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-5">
          <button
            class="flex-1 text-sm px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            :disabled="savingEdit"
            @click="saveEdit"
          >
            {{ savingEdit ? 'Saving…' : 'Save' }}
          </button>
          <button
            class="flex-1 text-sm px-3 py-2 rounded border border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-2"
            @click="editSession = null"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue"
import { call, toast } from "frappe-ui"

// --- state ---
const liveSessions = ref<any[]>([])
const sessionRecords = ref<any[]>([])
const health = ref<any>(null)
const qrCodes = ref<Record<string, string>>({})
const refreshing = ref(false)
const actionLoading = ref<Record<string, boolean>>({})
const showCreate = ref(false)
const showSettings = ref(false)
const creating = ref(false)
const savingSettings = ref(false)
const editSession = ref<any>(null)
const savingEdit = ref(false)

const newSession = ref({ id: "", label: "", agent: "" })
const settings = ref({ enabled: false, base_url: "", api_key: "", webhook_secret: "" })

// --- computed ---
const overallHealthy = computed(() => health.value?.overallHealth !== false)

/** Waaku live sessions merged with local Frappe records */
const mergedSessions = computed(() => {
  return liveSessions.value.map((s: any) => {
    const record = sessionRecords.value.find((r: any) => r.session_id === s.id) || null
    return { ...s, record }
  })
})

/** Frappe-registered sessions that have no matching live Waaku session */
const offlineSessions = computed(() => {
  const liveIds = new Set(liveSessions.value.map((s: any) => s.id))
  return sessionRecords.value.filter((r: any) => !liveIds.has(r.session_id))
})

// --- helpers ---
function statusDot(status: string) {
  if (status === "ready") return "bg-green-500"
  if (status === "qr_received" || status === "authenticated") return "bg-amber-400"
  if (status === "disconnected" || status === "auth_failed") return "bg-red-500"
  return "bg-gray-300"
}

function statusBadge(status: string) {
  if (status === "ready") return "bg-green-100 text-green-700"
  if (status === "qr_received") return "bg-amber-100 text-amber-700"
  if (status === "authenticated") return "bg-blue-100 text-blue-700"
  if (status === "disconnected") return "bg-red-100 text-red-700"
  if (status === "auth_failed") return "bg-red-100 text-red-700"
  return "bg-gray-100 text-gray-500"
}

function fmtUptime(sec?: number) {
  if (sec == null) return "–"
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

// --- data loading ---
async function refresh() {
  refreshing.value = true
  try {
    const [sessions, h, records] = await Promise.all([
      call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.get_sessions"),
      call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.get_health"),
      call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.get_session_records"),
    ])
    liveSessions.value = sessions || []
    health.value = h || null
    sessionRecords.value = records || []

    // Fetch QR codes for sessions needing it
    for (const s of liveSessions.value) {
      if (s.status === "qr_received") {
        fetchQr(s.id)
      }
    }
  } catch (e: any) {
    toast.create({ message: "Could not reach Waaku", type: "error" })
  } finally {
    refreshing.value = false
  }
}

async function fetchQr(sessionId: string) {
  try {
    const result = await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.get_qr", {
      session_id: sessionId,
    })
    if (result?.qr) {
      qrCodes.value[sessionId] = result.qr
    }
  } catch (_) {}
}

async function loadSettings() {
  try {
    const s = await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.get_waaku_settings")
    settings.value = { ...s, enabled: !!s.enabled }
  } catch (_) {}
}

// --- actions ---
async function createSession() {
  if (!newSession.value.id.trim()) {
    toast.create({ message: "Session ID is required", type: "warning" })
    return
  }
  creating.value = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.create_session", {
      session_id: newSession.value.id.trim(),
    })
    if (newSession.value.label || newSession.value.agent) {
      await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.update_session_record", {
        session_id: newSession.value.id.trim(),
        label: newSession.value.label || newSession.value.id.trim(),
        assigned_agent: newSession.value.agent || null,
      })
    }
    showCreate.value = false
    newSession.value = { id: "", label: "", agent: "" }
    toast.create({ message: "Session created — scan the QR to connect", type: "success" })
    await refresh()
  } catch (e: any) {
    toast.create({ message: "Failed to create session", type: "error" })
  } finally {
    creating.value = false
  }
}

async function startSession(sessionId: string) {
  actionLoading.value[sessionId] = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.create_session", { session_id: sessionId })
    toast.create({ message: "Session started", type: "success" })
    await refresh()
  } catch (_) {
    toast.create({ message: "Failed to start session", type: "error" })
  } finally {
    actionLoading.value[sessionId] = false
  }
}

async function restartSession(sessionId: string) {
  actionLoading.value[sessionId] = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.restart_session", { session_id: sessionId })
    toast.create({ message: "Session restarting…", type: "info" })
    setTimeout(refresh, 2000)
  } catch (_) {
    toast.create({ message: "Restart failed", type: "error" })
  } finally {
    actionLoading.value[sessionId] = false
  }
}

async function confirmDelete(sessionId: string) {
  if (!confirm(`Delete session "${sessionId}"? This will disconnect the WhatsApp account.`)) return
  actionLoading.value[sessionId] = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.delete_session", { session_id: sessionId })
    toast.create({ message: "Session deleted", type: "success" })
    await refresh()
  } catch (_) {
    toast.create({ message: "Delete failed", type: "error" })
  } finally {
    actionLoading.value[sessionId] = false
  }
}

function openEdit(s: any) {
  editSession.value = {
    id: s.id,
    label: s.record?.label || s.id,
    phone: s.record?.phone_number || "",
    agent: s.record?.assigned_agent || "",
  }
}

async function saveEdit() {
  if (!editSession.value) return
  savingEdit.value = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.update_session_record", {
      session_id: editSession.value.id,
      label: editSession.value.label,
      phone_number: editSession.value.phone,
      assigned_agent: editSession.value.agent,
    })
    toast.create({ message: "Session updated", type: "success" })
    editSession.value = null
    await refresh()
  } catch (_) {
    toast.create({ message: "Update failed", type: "error" })
  } finally {
    savingEdit.value = false
  }
}

async function saveSettings() {
  savingSettings.value = true
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.waaku.save_waaku_settings", {
      enabled: settings.value.enabled ? 1 : 0,
      base_url: settings.value.base_url,
      api_key: settings.value.api_key,
      webhook_secret: settings.value.webhook_secret,
    })
    toast.create({ message: "Settings saved", type: "success" })
  } catch (_) {
    toast.create({ message: "Failed to save settings", type: "error" })
  } finally {
    savingSettings.value = false
  }
}

// --- lifecycle ---
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await Promise.all([refresh(), loadSettings()])
  autoRefreshTimer = setInterval(refresh, 15000)
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>
