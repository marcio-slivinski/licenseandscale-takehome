/**
 * PDF generator — react-pdf component + render helper.
 *
 * Template: clean professional Greenscape Pro proposal. Not pretty-pretty, but clean and
 * legible — header, scope line items, total, footer.
 *
 * Runs server-side (in a server action) via `renderToBuffer`.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { Proposal, ProposalLineItem } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 50, fontSize: 11, fontFamily: "Helvetica", color: "#222" },
  header: { borderBottomWidth: 2, borderBottomColor: "#1f2937", paddingBottom: 12, marginBottom: 20 },
  companyName: { fontSize: 22, fontWeight: 700, color: "#1f2937" },
  tagline: { fontSize: 10, color: "#6b7280", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 11, marginTop: 2 },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: "#1f2937",
    marginTop: 14, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 3,
  },
  narrativeText: { lineHeight: 1.5, color: "#333" },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6, paddingHorizontal: 4,
    fontWeight: 700, fontSize: 9, color: "#374151",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb",
  },
  col1: { width: "55%" },
  col2: { width: "15%", textAlign: "right" },
  col3: { width: "15%", textAlign: "right" },
  col4: { width: "15%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 10, paddingHorizontal: 4,
    marginTop: 4,
    backgroundColor: "#1f2937",
    color: "white", fontWeight: 700,
  },
  footer: {
    marginTop: 28, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#e5e7eb",
    fontSize: 9, color: "#6b7280", lineHeight: 1.4,
  },
});

type Props = {
  proposal: Proposal;
  lead: { name: string; project_address: string | null };
  lineItems: Array<ProposalLineItem & { item_name: string }>;
};

export function ProposalDocument({ proposal, lead, lineItems }: Props) {
  const dateStr = new Date(proposal.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const included = lineItems.filter((li) => !li.needs_review);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Greenscape Pro</Text>
          <Text style={styles.tagline}>Premium outdoor living, Phoenix AZ.</Text>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Prepared for</Text>
            <Text style={styles.metaValue}>{lead.name}</Text>
            {lead.project_address && <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>{lead.project_address}</Text>}
          </View>
          <View>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
            <Text style={styles.metaLabel}>Proposal #</Text>
            <Text style={{ fontSize: 9, color: "#6b7280" }}>{proposal.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {proposal.narrative && (
          <>
            <Text style={styles.sectionTitle}>Project Overview</Text>
            <Text style={styles.narrativeText}>{proposal.narrative}</Text>
          </>
        )}

        <Text style={styles.sectionTitle}>Scope & Investment</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Item</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Unit Price</Text>
            <Text style={styles.col4}>Subtotal</Text>
          </View>
          {included.map((li) => (
            <View style={styles.tableRow} key={li.id}>
              <Text style={styles.col1}>{li.item_name}</Text>
              <Text style={styles.col2}>{li.quantity.toString()}</Text>
              <Text style={styles.col3}>${li.unit_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Text>
              <Text style={styles.col4}>${li.subtotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.col1, { color: "white" }]}>Total Investment</Text>
            <Text style={[styles.col2, { color: "white" }]}> </Text>
            <Text style={[styles.col3, { color: "white" }]}> </Text>
            <Text style={[styles.col4, { color: "white" }]}>
              ${(proposal.total ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>50% deposit due on signature. Balance due at project completion.</Text>
          <Text>Estimate valid for 30 days. Scope subject to site verification.</Text>
          <Text style={{ marginTop: 4 }}>Greenscape Pro · contact@greenscapepro.com · Phoenix, AZ</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderProposalPDF(props: Props): Promise<Buffer> {
  return await renderToBuffer(<ProposalDocument {...props} />);
}
