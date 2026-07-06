"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import { listInvoices, invoiceTotals, listIntegrations } from "@/lib/mock/store";
import { can, Role } from "@/lib/rbac";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  DRAFT: "neutral",
  SENT: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

// Subscription billing (per-seat plan + AI add-ons), all amounts in USD.
// Real implementation charges via Stripe Billing (see README) — this view
// mirrors the resulting invoice objects, gated by the "billing:view" permission.
export default function BillingPage() {
  const viewerRole: Role = "GLOBAL_ADMIN"; // demo viewer
  const invoices = listInvoices();
  const totals = invoiceTotals();
  const stripe = listIntegrations().find((i) => i.provider === "STRIPE");
  const [stripeConnected, setStripeConnected] = useState(stripe?.connected ?? false);

  if (!can(viewerRole, "billing:view")) {
    return <Card className="text-sm text-slate-400">You don't have access to billing.</Card>;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Billing</h1>
      <p className="mb-6 text-sm text-slate-400">Subscription invoices — all amounts in USD.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <div className="text-2xl font-bold text-success">${totals.paid.toLocaleString("en-US")}</div>
          <div className="text-xs text-slate-500">Paid</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-warning">${totals.outstanding.toLocaleString("en-US")}</div>
          <div className="text-xs text-slate-500">Outstanding</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-slate-400">${totals.draft.toLocaleString("en-US")}</div>
          <div className="text-xs text-slate-500">Draft</div>
        </Card>
      </div>

      <Card className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard size={18} className="text-accent-400" />
          <div>
            <div className="text-sm font-medium">Stripe</div>
            <div className="text-xs text-slate-500">
              {stripeConnected ? "Connected — invoices sync automatically" : "Connect to enable automated invoicing and payment collection"}
            </div>
          </div>
        </div>
        {stripeConnected ? (
          <Badge tone="success">Connected</Badge>
        ) : (
          <Button variant="secondary" onClick={() => setStripeConnected(true)}>
            Connect
          </Button>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr className="border-b border-base-700">
              <th className="p-3">Invoice</th>
              <th className="p-3">Description</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Issued</th>
              <th className="p-3">Due</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-base-700/60">
                <td className="p-3 font-mono text-xs text-accent-400">{inv.number}</td>
                <td className="p-3">{inv.description}</td>
                <td className="p-3">${inv.amount.toLocaleString("en-US")}</td>
                <td className="p-3 text-slate-400">{inv.issuedAt}</td>
                <td className="p-3 text-slate-400">{inv.dueAt ?? "—"}</td>
                <td className="p-3"><Badge tone={STATUS_TONE[inv.status]}>{inv.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
