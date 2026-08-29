import { describe, expect, it } from "vitest";
import { buildRequestPlan, requestPlanToTaskNodes } from "./planner";

describe("request planner", () => {
  it("decomposes a product request into epics and input-specific tickets", () => {
    const plan = buildRequestPlan({
      projectId: "project-alpha",
      sessionId: "session-1",
      objective:
        "Créer un outil web avec API, tickets, Knowledge Base et connexion GitHub.",
      riskLevel: "standard",
    });
    expect(plan.epics.map(({ epicKey }) => epicKey)).toEqual([
      "discovery",
      "delivery",
      "assurance",
    ]);
    expect(plan.tickets.map(({ ticketKey }) => ticketKey)).toEqual([
      "scope",
      "architecture",
      "frontend",
      "backend",
      "data",
      "integration",
      "verification",
      "delivery-review",
    ]);
    expect(
      plan.tickets.find(({ ticketKey }) => ticketKey === "verification")
        ?.dependsOn,
    ).toEqual(["frontend", "backend", "data", "integration"]);
    expect(requestPlanToTaskNodes(plan).at(-1)?.humanGate).toBe(
      "delivery-review",
    );
  });

  it("adds a security ticket for non-standard risk without duplicating it", () => {
    const plan = buildRequestPlan({
      projectId: "project-alpha",
      sessionId: "session-2",
      objective: "Modifier une API critique avec authentification.",
      riskLevel: "critical",
    });
    expect(
      plan.tickets.filter(({ capability }) => capability === "security"),
    ).toHaveLength(1);
  });

  it("falls back to a generic engineering ticket for an unknown domain", () => {
    const plan = buildRequestPlan({
      projectId: "project-alpha",
      sessionId: "session-3",
      objective: "Calculer un résultat spécialisé.",
      riskLevel: "standard",
    });
    expect(
      plan.tickets.some(({ ticketKey }) => ticketKey === "implementation"),
    ).toBe(true);
  });

  it("decomposes the Print My Mind MVP into small ordered delivery areas", () => {
    const plan = buildRequestPlan({
      projectId: "print-my-mind",
      sessionId: "session-pmm",
      objective:
        "Construire le MVP Print My Mind avec Stripe, génération Meshy asynchrone, stockage privé, visionneuse GLB, analyse d’imprimabilité et exports STL et 3MF.",
      riskLevel: "sensitive",
    });

    expect(plan.epics.map(({ epicKey }) => epicKey)).toEqual([
      "saas-foundation",
      "meshy-generation",
      "viewer-history",
      "printability-export",
      "hardening-launch",
    ]);
    expect(plan.tickets).toHaveLength(22);
    expect(
      plan.tickets.find(({ ticketKey }) => ticketKey === "generation-jobs")
        ?.dependsOn,
    ).toEqual(["meshy-adapter", "quota-ledger"]);
    expect(
      plan.tickets.find(({ ticketKey }) => ticketKey === "secure-download")
        ?.acceptanceCriteria,
    ).toContain(
      "Une URL signée courte est créée uniquement pour le propriétaire",
    );
    expect(plan.tickets.at(-1)?.ticketKey).toBe("delivery-review");
    expect(requestPlanToTaskNodes(plan).at(-1)?.humanGate).toBe(
      "delivery-review",
    );
  });
});
