import type { ServiceRequestStatus } from "@/lib/generated/prisma";

export type ServiceRequestAction = "accept" | "decline" | "start" | "markFinished" | "confirmComplete" | "cancel";
export type Participant = "customer" | "worker";

/**
 * State machine: REQUESTED → ACCEPTED → IN_PROGRESS → COMPLETED, plus DECLINED / CANCELLED.
 * Only the customer can confirm completion; the worker can only report the work as finished.
 */
const RULES: Record<ServiceRequestAction, { by: Participant[]; from: ServiceRequestStatus[]; to: ServiceRequestStatus }> = {
  accept: { by: ["worker"], from: ["REQUESTED"], to: "ACCEPTED" },
  decline: { by: ["worker"], from: ["REQUESTED"], to: "DECLINED" },
  start: { by: ["worker"], from: ["ACCEPTED"], to: "IN_PROGRESS" },
  markFinished: { by: ["worker"], from: ["IN_PROGRESS"], to: "IN_PROGRESS" },
  confirmComplete: { by: ["customer"], from: ["IN_PROGRESS"], to: "COMPLETED" },
  // Customers may cancel before work starts; workers may withdraw after accepting but before starting.
  cancel: { by: ["customer", "worker"], from: ["REQUESTED", "ACCEPTED"], to: "CANCELLED" },
};

export function nextServiceRequestStatus(
  current: ServiceRequestStatus,
  action: ServiceRequestAction,
  actor: Participant,
): { ok: true; to: ServiceRequestStatus } | { ok: false; reason: string } {
  const rule = RULES[action];
  if (!rule.by.includes(actor)) return { ok: false, reason: "You are not allowed to perform this action." };
  if (action === "cancel" && actor === "worker" && current === "REQUESTED") {
    return { ok: false, reason: "Decline the request instead of cancelling it." };
  }
  if (!rule.from.includes(current)) return { ok: false, reason: `This action is not possible while the request is ${current.toLowerCase().replace("_", " ")}.` };
  return { ok: true, to: rule.to };
}

export function availableActions(status: ServiceRequestStatus, actor: Participant): ServiceRequestAction[] {
  return (Object.keys(RULES) as ServiceRequestAction[]).filter((a) => nextServiceRequestStatus(status, a, actor).ok);
}

export const TERMINAL_STATUSES: ServiceRequestStatus[] = ["COMPLETED", "DECLINED", "CANCELLED"];
