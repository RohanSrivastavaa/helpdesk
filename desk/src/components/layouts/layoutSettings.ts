import LucideBarChart2 from "~icons/lucide/bar-chart-2";
import LucideBookOpen from "~icons/lucide/book-open";
import LucideContact2 from "~icons/lucide/contact-2";
import LucideClock from "~icons/lucide/clock";
import LucideAlertTriangle from "~icons/lucide/alert-triangle";
import LucideGitBranch from "~icons/lucide/git-branch";
import LucideTarget from "~icons/lucide/target";
import LucideLayoutDashboard from "~icons/lucide/layout-dashboard";
import LucideRadio from "~icons/lucide/radio";
import LucideTimerOff from "~icons/lucide/timer-off";
import LucideTicket from "~icons/lucide/ticket";
import LucideUsers from "~icons/lucide/users";
import LucideShieldCheck from "~icons/lucide/shield-check";
import LucideCalendarClock from "~icons/lucide/calendar-clock";
import LucideBrainCircuit from "~icons/lucide/brain-circuit";
import LucideClipboardCheck from "~icons/lucide/clipboard-check";
import LucidePhoneOff from "~icons/lucide/phone-off";
import LucideUser from "~icons/lucide/user";
import LucideSmartphone from "~icons/lucide/smartphone";
import { OrganizationsIcon } from "../icons";
import PhoneIcon from "../icons/PhoneIcon.vue";
import { __ } from "@/translation";

export const agentPortalSidebarOptions = [
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsAgent",
  },
  {
    label: __("Live Dashboard"),
    icon: LucideLayoutDashboard,
    to: "LiveDashboard",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "AgentKnowledgeBase",
  },
  {
    label: __("Customers"),
    icon: OrganizationsIcon,
    to: "CustomerList",
  },
  {
    label: __("Contacts"),
    icon: LucideContact2,
    to: "ContactList",
  },
  {
    label: __("Call Logs"),
    icon: PhoneIcon,
    to: "CallLogs",
  },
  {
    label: __("Agent Status"),
    icon: LucideUsers,
    to: "AgentStatusDashboard",
  },
  {
    label: __("Resolution Time"),
    icon: LucideClock,
    to: "AgentResolutionTime",
  },
  {
    label: __("Performance"),
    icon: LucideBarChart2,
    to: "AgentPerformanceDashboard",
  },
  {
    label: __("Aging Report"),
    icon: LucideClock,
    to: "TicketAgingReport",
  },
  {
    label: __("FCR Report"),
    icon: LucideTarget,
    to: "FCRReport",
  },
  {
    label: __("Auto-Assign"),
    icon: LucideGitBranch,
    to: "AutoAssignSettings",
  },
  {
    label: __("Escalation Rules"),
    icon: LucideAlertTriangle,
    to: "EscalationRules",
  },
  {
    label: __("WA Broadcast"),
    icon: LucideRadio,
    to: "WhatsAppBroadcast",
  },
  {
    label: __("Auto-Close"),
    icon: LucideTimerOff,
    to: "AutoCloseSettings",
  },
  {
    label: __("SLA Report"),
    icon: LucideShieldCheck,
    to: "SLAComplianceReport",
  },
  {
    label: __("My Shift"),
    icon: LucideCalendarClock,
    to: "ShiftSchedule",
  },
  {
    label: __("Skill Routing"),
    icon: LucideBrainCircuit,
    to: "SkillRouting",
  },
  {
    label: __("QA Report"),
    icon: LucideClipboardCheck,
    to: "QAReport",
  },
  {
    label: __("WA Opt-Out"),
    icon: LucidePhoneOff,
    to: "WAOptOut",
  },
  {
    label: __("My Stats"),
    icon: LucideUser,
    to: "MyStats",
  },
  {
    label: __("Waaku Sessions"),
    icon: LucideSmartphone,
    to: "WaakuMonitor",
  },
];

// Restricted sidebar for plain agents (role "Agent" without "Agent Manager").
// They only see their assigned tickets and their own stats.
export const restrictedAgentSidebarOptions = [
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsAgent",
  },
  {
    label: __("My Stats"),
    icon: LucideUser,
    to: "MyStats",
  },
];

export const customerPortalSidebarOptions = [
  {
    label: __("Tickets"),
    icon: LucideTicket,
    to: "TicketsCustomer",
  },
  {
    label: __("Knowledge Base"),
    icon: LucideBookOpen,
    to: "CustomerKnowledgeBase",
  },
];
