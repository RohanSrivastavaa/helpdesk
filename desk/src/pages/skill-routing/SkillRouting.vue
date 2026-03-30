<template>
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <span class="text-lg font-medium text-gray-900">Skill-Based Routing</span>
      </template>
    </LayoutHeader>

    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
      <div v-if="loading" class="flex items-center justify-center h-40 text-ink-gray-4 text-sm">
        Loading…
      </div>

      <template v-else>

        <!-- ── Skill master list ───────────────────────────────────── -->
        <div class="rounded-xl border bg-surface-white">
          <div class="flex items-center justify-between px-5 py-3 border-b bg-surface-gray-1">
            <h3 class="text-sm font-semibold text-ink-gray-7">Skills</h3>
            <div class="flex items-center gap-2">
              <input
                v-model="newSkill"
                type="text"
                placeholder="New skill name…"
                class="rounded border border-outline-gray-2 px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                @keydown.enter="createSkill"
              />
              <Button size="sm" variant="solid" :loading="creatingSkill" @click="createSkill">Add</Button>
            </div>
          </div>
          <div v-if="skills.length" class="flex flex-wrap gap-2 p-4">
            <span
              v-for="skill in skills"
              :key="skill.name"
              class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-medium text-blue-800"
            >
              {{ skill.skill_name }}
              <button
                class="text-blue-400 hover:text-red-500 transition-colors ml-0.5"
                title="Delete skill"
                @click="deleteSkill(skill.name)"
              >✕</button>
            </span>
          </div>
          <p v-else class="text-sm text-ink-gray-4 p-4">No skills defined yet. Add one above.</p>
        </div>

        <!-- ── Agent → Skills mapping ──────────────────────────────── -->
        <div class="rounded-xl border bg-surface-white overflow-hidden">
          <div class="px-5 py-3 border-b bg-surface-gray-1">
            <h3 class="text-sm font-semibold text-ink-gray-7">Agent Skills</h3>
          </div>
          <div v-if="agents.length" class="divide-y">
            <div
              v-for="agent in agents"
              :key="agent.user"
              class="flex items-center gap-4 px-5 py-3"
            >
              <!-- Avatar -->
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                :style="{ backgroundColor: avatarColor(agent.user) }"
              >{{ initials(agent.full_name) }}</span>
              <div class="min-w-0 w-36">
                <p class="font-medium text-sm text-ink-gray-8 truncate">{{ agent.full_name }}</p>
                <p class="text-xs text-ink-gray-4 truncate">{{ agent.user }}</p>
              </div>
              <!-- Skill checkboxes -->
              <div class="flex flex-wrap gap-2 flex-1">
                <label
                  v-for="skill in skills"
                  :key="skill.name"
                  class="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="accent-blue-600"
                    :checked="agentHasSkill(agent.user, skill.name)"
                    @change="toggleAgentSkill(agent, skill.name, ($event.target as HTMLInputElement).checked)"
                  />
                  <span class="text-sm text-ink-gray-7">{{ skill.skill_name }}</span>
                </label>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-ink-gray-4 p-4">No agents found.</p>
        </div>

        <!-- ── Ticket Type → Required Skill ───────────────────────── -->
        <div class="rounded-xl border bg-surface-white overflow-hidden">
          <div class="px-5 py-3 border-b bg-surface-gray-1">
            <h3 class="text-sm font-semibold text-ink-gray-7">Required Skill per Ticket Type</h3>
            <p class="text-xs text-ink-gray-4 mt-0.5">
              When a ticket of this type is created, routing prefers agents with the matched skill
            </p>
          </div>
          <div v-if="ticketTypes.length" class="divide-y">
            <div
              v-for="tt in ticketTypes"
              :key="tt.name"
              class="flex items-center gap-4 px-5 py-3"
            >
              <span class="w-40 text-sm font-medium text-ink-gray-8 truncate">{{ tt.name }}</span>
              <select
                class="rounded border border-outline-gray-2 px-2 py-1 text-sm text-ink-gray-8 focus:outline-none focus:border-blue-400"
                :value="tt.required_skill || ''"
                @change="setTicketTypeSkill(tt.name, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— None —</option>
                <option v-for="s in skills" :key="s.name" :value="s.name">{{ s.skill_name }}</option>
              </select>
            </div>
          </div>
          <p v-else class="text-sm text-ink-gray-4 p-4">No ticket types defined.</p>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LayoutHeader from "@/components/LayoutHeader.vue";
import { Button, call, toast } from "frappe-ui";
import { onMounted, ref } from "vue";

interface Skill { name: string; skill_name: string }
interface Agent { user: string; full_name: string; skills: string[] }
interface TicketType { name: string; required_skill: string | null }

const loading = ref(true);
const creatingSkill = ref(false);
const newSkill = ref("");
const skills = ref<Skill[]>([]);
const agents = ref<Agent[]>([]);
const ticketTypes = ref<TicketType[]>([]);

async function loadAll() {
  loading.value = true;
  try {
    const [sk, ag, tt] = await Promise.all([
      call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.get_all_skills"),
      loadAgents(),
      call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.get_ticket_type_skills"),
    ]);
    skills.value = sk ?? [];
    ticketTypes.value = tt ?? [];
  } finally {
    loading.value = false;
  }
}

async function loadAgents() {
  const agentList = await call("helpdesk.helpdesk.doctype.hd_agent.api.get_all_agents").catch(() => null);
  const fallback = await call("fitelo_helpdesk.fitelo_helpdesk.api.agent_status.get_all_agent_statuses").catch(() => []);
  const list = agentList ?? fallback ?? [];
  // Fetch skills per agent
  const result: Agent[] = [];
  for (const a of list) {
    const user = a.user || a.email || a.agent_user || "";
    const full_name = a.full_name || a.agent_name || user;
    if (!user) continue;
    const agentSkills = await call(
      "fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.get_agent_skills",
      { agent_user: user }
    ).catch(() => []);
    result.push({ user, full_name, skills: agentSkills ?? [] });
  }
  agents.value = result;
}

async function createSkill() {
  const name = newSkill.value.trim();
  if (!name) return;
  creatingSkill.value = true;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.create_skill", { skill_name: name });
    newSkill.value = "";
    await loadAll();
    toast.create({ message: `Skill "${name}" created`, type: "success" });
  } catch (e: any) {
    toast.create({ message: e?.message || "Failed to create skill", type: "error" });
  } finally {
    creatingSkill.value = false;
  }
}

async function deleteSkill(skillName: string) {
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.delete_skill", { skill_name: skillName });
    await loadAll();
    toast.create({ message: "Skill deleted", type: "success" });
  } catch {
    toast.create({ message: "Failed to delete", type: "error" });
  }
}

function agentHasSkill(userEmail: string, skillName: string): boolean {
  return agents.value.find(a => a.user === userEmail)?.skills.includes(skillName) ?? false;
}

async function toggleAgentSkill(agent: Agent, skillName: string, checked: boolean) {
  const newSkills = checked
    ? [...agent.skills, skillName]
    : agent.skills.filter(s => s !== skillName);
  agent.skills = newSkills;
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.set_agent_skills", {
      agent_user: agent.user,
      skills: JSON.stringify(newSkills),
    });
  } catch {
    // revert
    agent.skills = checked
      ? agent.skills.filter(s => s !== skillName)
      : [...agent.skills, skillName];
    toast.create({ message: "Failed to update skills", type: "error" });
  }
}

async function setTicketTypeSkill(ticketType: string, skillName: string) {
  try {
    await call("fitelo_helpdesk.fitelo_helpdesk.api.skill_routing.set_ticket_type_skill", {
      ticket_type: ticketType,
      required_skill: skillName,
    });
    const tt = ticketTypes.value.find(t => t.name === ticketType);
    if (tt) tt.required_skill = skillName || null;
  } catch {
    toast.create({ message: "Failed to update", type: "error" });
  }
}

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];
function avatarColor(email: string): string {
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

onMounted(loadAll);
</script>
