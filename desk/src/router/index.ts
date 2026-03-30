import { useScreenSize } from "@/composables/screen";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";
import { isCustomerPortal } from "@/utils";
import { createRouter, createWebHistory } from "vue-router";
const { isMobileView } = useScreenSize();

export const LOGIN_PAGE = "/login";

// type the meta fields
declare module "vue-router" {
  interface RouteMeta {
    auth?: boolean;
    agent?: boolean;
    admin?: boolean;
    public?: boolean;
    onSuccessRoute?: string;
    parent?: string;
  }
}

const routes = [
  // Agent Portal Routes
  {
    path: "/",
    name: "Home",
    redirect: "/tickets",
  },

  {
    path: "/tickets",
    name: "TicketsAgent",
    component: () => import("@/pages/ticket/Tickets.vue"),
  },
  {
    path: "/tickets/:ticketId",
    name: "TicketAgent",
    component: () =>
      import(`@/pages/ticket/${handleMobileView("TicketAgent")}.vue`),
    props: true,
  },
  {
    path: "/tickets/new/:templateId?",
    name: "TicketAgentNew",
    component: () => import("@/pages/ticket/TicketNew.vue"),
    props: true,
    meta: {
      onSuccessRoute: "TicketAgent",
      parent: "TicketsAgent",
    },
  },
  {
    path: "/notifications",
    name: "Notifications",
    component: () => import("@/pages/MobileNotifications.vue"),
  },
  {
    path: "/kb",
    name: "AgentKnowledgeBase",
    component: () => import("@/pages/knowledge-base/KnowledgeBaseAgent.vue"),
  },
  {
    path: "/search",
    name: "SearchAgent",
    component: () => import("@/pages/SearchAgent.vue"),
    meta: { auth: true },
  },
  {
    path: "/kb/articles/:articleId",
    name: "Article",
    component: () => import("@/pages/knowledge-base/Article.vue"),
    props: true,
  },
  {
    path: "/articles/new/:id",
    name: "NewArticle",
    component: () => import("@/pages/knowledge-base/NewArticle.vue"),
    props: true,
  },
  {
    path: "/customers",
    name: "CustomerList",
    component: () => import("@/pages/desk/customer/Customers.vue"),
  },
  {
    path: "/contacts",
    name: "ContactList",
    component: () => import("@/pages/desk/contact/Contacts.vue"),
  },
  {
    path: "/agents",
    name: "AgentList",
    redirect: "/tickets",
  },
  {
    path: "/teams",
    name: "Teams",
    redirect: "/tickets",
  },
  {
    path: "/teams/:teamId",
    name: "Team",
    redirect: "/tickets",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/pages/dashboard/Dashboard.vue"),
  },
  {
    path: "/agent-status",
    name: "AgentStatusDashboard",
    component: () => import("@/pages/agent-status/AgentStatusDashboard.vue"),
  },
  {
    path: "/agent-performance",
    name: "AgentPerformanceDashboard",
    component: () => import("@/pages/agent-performance/AgentPerformanceDashboard.vue"),
  },
  {
    path: "/call-logs",
    name: "CallLogs",
    component: () => import("@/pages/call-logs/CallLogs.vue"),
  },
  {
    path: "/live-dashboard",
    name: "LiveDashboard",
    component: () => import("@/pages/live-dashboard/LiveDashboard.vue"),
  },
  {
    path: "/dashboards/reason-breakdown",
    name: "ReasonBreakdown",
    component: () => import("@/pages/dashboards/ReasonBreakdown.vue"),
  },
  {
    path: "/dashboards/agent-performance",
    name: "AgentPerformanceDaily",
    component: () => import("@/pages/dashboards/AgentPerformanceDaily.vue"),
  },
  {
    path: "/dashboards/agent-timing",
    name: "AgentTiming",
    component: () => import("@/pages/dashboards/AgentTiming.vue"),
  },
  {
    path: "/dashboards/agent-board",
    name: "AgentBoard",
    component: () => import("@/pages/dashboards/AgentBoard.vue"),
  },
  {
    path: "/dashboards/agent-availability",
    name: "AgentAvailability",
    component: () => import("@/pages/dashboards/AgentAvailability.vue"),
  },
  {
    path: "/ticket-aging",
    name: "TicketAgingReport",
    component: () => import("@/pages/ticket-aging/TicketAgingReport.vue"),
  },
  {
    path: "/fcr",
    name: "FCRReport",
    component: () => import("@/pages/fcr/FCRReport.vue"),
  },
  {
    path: "/auto-assign",
    name: "AutoAssignSettings",
    component: () => import("@/pages/auto-assign/AutoAssignSettings.vue"),
  },
  {
    path: "/escalation-rules",
    name: "EscalationRules",
    component: () => import("@/pages/escalation-rules/EscalationRules.vue"),
  },
  {
    path: "/broadcast",
    name: "WhatsAppBroadcast",
    component: () => import("@/pages/broadcast/WhatsAppBroadcast.vue"),
  },
  {
    path: "/auto-close",
    name: "AutoCloseSettings",
    component: () => import("@/pages/auto-close/AutoCloseSettings.vue"),
  },
  {
    path: "/sla-compliance",
    name: "SLAComplianceReport",
    component: () => import("@/pages/sla-compliance/SLAComplianceReport.vue"),
  },
  {
    path: "/shift-schedule",
    name: "ShiftSchedule",
    component: () => import("@/pages/shift-schedule/ShiftSchedule.vue"),
  },
  {
    path: "/skill-routing",
    name: "SkillRouting",
    component: () => import("@/pages/skill-routing/SkillRouting.vue"),
  },
  {
    path: "/qa-report",
    name: "QAReport",
    component: () => import("@/pages/qa-report/QAReport.vue"),
  },
  {
    path: "/wa-optout",
    name: "WAOptOut",
    component: () => import("@/pages/wa-optout/WAOptOut.vue"),
  },
  {
    path: "/my-stats",
    name: "MyStats",
    component: () => import("@/pages/my-stats/MyStats.vue"),
  },
  {
    path: "/waaku-monitor",
    name: "WaakuMonitor",
    component: () => import("@/pages/waaku-monitor/WaakuMonitor.vue"),
  },

  // Customer Portal Routes
  {
    path: "/my-tickets",
    name: "TicketsCustomer",
    component: () => import("@/pages/ticket/Tickets.vue"),
    meta: {
      public: true,
      auth: true,
    },
  },
  {
    path: "/my-tickets/:ticketId",
    name: "TicketCustomer",
    component: () => import("@/pages/ticket/TicketCustomer.vue"),
    meta: {
      public: true,
      auth: true,
    },
    props: true,
  },
  {
    path: "/my-tickets/new",
    name: "TicketNew",
    component: () => import("@/pages/ticket/TicketNew.vue"),
    props: true,
    meta: {
      onSuccessRoute: "TicketCustomer",
      parent: "TicketsCustomer",
      public: true,
      auth: true,
    },
  },
  {
    path: "/kb-public",
    name: "CustomerKnowledgeBase",
    component: () => import("@/pages/knowledge-base/KnowledgeBaseCustomer.vue"),
    meta: {
      public: true,
      auth: true,
    },
  },
  {
    path: "/kb-public/:categoryId",
    name: "Articles",
    component: () => import("@/pages/knowledge-base/Articles.vue"),
    props: true,
    meta: {
      public: true,
      auth: true,
    },
  },
  {
    path: "/kb-public/articles/:articleId",
    name: "ArticlePublic",
    component: () => import("@/pages/knowledge-base/Article.vue"),
    props: true,
    meta: {
      public: true,
      auth: true,
    },
  },

  // Additonal routes
  {
    path: "/:pathMatch(.*)*",
    name: "Invalid Page",
    component: () => import("@/pages/InvalidPage.vue"),
  },
];

const handleMobileView = (componentName) => {
  return isMobileView.value ? `Mobile${componentName}` : componentName;
};

export const router = createRouter({
  history: createWebHistory("/helpdesk/"),
  routes,
});

router.beforeEach(async (to, _, next) => {
  const authStore = useAuthStore();
  isCustomerPortal.value = to.meta.public || false;
  if (authStore.isLoggedIn) {
    await authStore.init();
  }

  if (!authStore.isLoggedIn) {
    const redirectURL = to.fullPath !== "/" ? to.fullPath : "";

    window.location.href =
      LOGIN_PAGE +
      (redirectURL ? `?redirect-to=/helpdesk${redirectURL}` : "/helpdesk");
  } else if (!to.meta.public && !authStore.hasDeskAccess) {
    next({ name: "TicketsCustomer" });
  } else if (to.name === "TicketAgent" && !authStore.isAgent) {
    const ticketId = to.params.ticketId;
    next({
      name: "TicketCustomer",
      params: { ticketId },
    });
  } else {
    next();
  }
});

router.afterEach(async (to) => {
  if (to.meta.public) return;
  const { users } = useUserStore();
  if (!users?.fetched) {
    await users.fetch();
  }
});
