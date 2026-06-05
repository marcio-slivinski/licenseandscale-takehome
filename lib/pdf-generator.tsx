/**
 * PDF generator — react-pdf component + render helper.
 *
 * Template: clean professional Greenscape Pro proposal. Header, narrative (paragraphs preserved),
 * line items table, total, footer. Runs server-side via renderToBuffer.
 *
 * Narrative is plain prose (no markdown — stripped upstream in narrative-writer.ts). Paragraphs are
 * split on blank lines and rendered as separate Text blocks for proper spacing.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { Proposal, ProposalLineItem } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", color: "#1c2421" },
  header: { borderBottomWidth: 2, borderBottomColor: "#2d5a3d", paddingBottom: 14, marginBottom: 22 },
  companyName: { fontSize: 22, fontWeight: 700, color: "#1f4029" },
  tagline: { fontSize: 10, color: "#7a857f", marginTop: 3 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  metaLabel: { fontSize: 9, color: "#7a857f", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 11, marginTop: 2, color: "#1c2421" },
  metaSubValue: { fontSize: 9, color: "#7a857f", marginTop: 1 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: "#1f4029",
    textTransform: "uppercase", letterSpacing: 1,
    marginTop: 18, marginBottom: 8,
  },
  narrativeParagraph: { lineHeight: 1.55, color: "#1c2421", marginBottom: 9, fontSize: 11 },
  table: { marginTop: 6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f7f5f1",
    paddingVertical: 7, paddingHorizontal: 6,
    fontWeight: 700, fontSize: 9, color: "#4a5550",
    borderBottomWidth: 1, borderBottomColor: "#d4cdbf",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7, paddingHorizontal: 6,
    borderBottomWidth: 0.5, borderBottomColor: "#e3ddd2",
  },
  col1: { width: "55%" },
  col2: { width: "12%", textAlign: "right" },
  col3: { width: "16%", textAlign: "right" },
  col4: { width: "17%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 12, paddingHorizontal: 6,
    marginTop: 6,
    backgroundColor: "#1f4029",
    color: "white", fontWeight: 700,
    borderRadius: 2,
  },
  footer: {
    marginTop: 32, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: "#e3ddd2",
    fontSize: 9, color: "#7a857f", lineHeight: 1.5,
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
  const paragraphs = splitParagraphs(proposal.narrative ?? "");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Greenscape Pro</Text>
          <Text style={styles.tagline}>Premium outdoor living · Phoenix, Arizona</Text>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Prepared for</Text>
            <Text style={styles.metaValue}>{lead.name}</Text>
            {lead.project_address && <Text style={styles.metaSubValue}>{lead.project_address}</Text>}
          </View>
          <View>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{dateStr}</Text>
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Proposal #</Text>
            <Text style={styles.metaSubValue}>{proposal.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {paragraphs.length > 0 && (
          <>
            {paragraphs.map((p, i) => (
              <Text key={i} style={styles.narrativeParagraph}>{p}</Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Scope &amp; Investment</Text>
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
          <Text>50% deposit due on signature, balance at project completion.</Text>
          <Text>Estimate valid for 30 days. Final scope subject to site verification.</Text>
          <Text style={{ marginTop: 6 }}>Greenscape Pro · Phoenix, AZ</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Split narrative into paragraphs on blank lines. Keeps single-line breaks within a paragraph. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function renderProposalPDF(props: Props): Promise<Buffer> {
  return await renderToBuffer(<ProposalDocument {...props} />);
}
