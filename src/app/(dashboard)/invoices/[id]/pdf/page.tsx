"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PDFViewer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { Invoice, Settings } from "@/types";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b", backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  fromBlock: { maxWidth: 200 },
  toBlock: { maxWidth: 200 },
  businessName: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4, color: "#0f172a" },
  label: { fontSize: 8, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1 solid #e2e8f0" },
  invoiceNumber: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  table: { marginTop: 16 },
  tableHeader: { flexDirection: "row", borderBottom: "1 solid #e2e8f0", paddingBottom: 8, marginBottom: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottom: "1 solid #f1f5f9" },
  colDesc: { flex: 3 },
  colNum: { flex: 1, textAlign: "right" },
  colBold: { fontFamily: "Helvetica-Bold" },
  totalsSection: { marginTop: 20, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", gap: 40, marginBottom: 4 },
  totalLabel: { color: "#64748b", width: 80, textAlign: "right" },
  totalValue: { width: 80, textAlign: "right" },
  totalFinal: { fontFamily: "Helvetica-Bold", fontSize: 12, color: "#0f172a" },
  notes: { marginTop: 40, paddingTop: 16, borderTop: "1 solid #e2e8f0" },
  paidWatermark: { position: "absolute", top: 200, left: 80, fontSize: 72, fontFamily: "Helvetica-Bold", color: "#22c55e", opacity: 0.15, transform: "rotate(-35deg)" },
});

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function InvoicePDF({ invoice, settings }: { invoice: Invoice; settings: Settings | null }) {
  const subtotal = (invoice.items ?? []).reduce((s, i) => s + i.amount, 0);
  const taxAmount = Math.round(subtotal * ((invoice.taxRate ?? 0) / 100) * 100) / 100;
  const total = subtotal + taxAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {invoice.status === "PAID" && <Text style={styles.paidWatermark}>PAID</Text>}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.toBlock}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{invoice.client?.name}</Text>
            {invoice.client?.email && <Text style={{ color: "#64748b" }}>{invoice.client.email}</Text>}
            {invoice.client?.address && <Text style={{ color: "#64748b", marginTop: 2 }}>{invoice.client.address}</Text>}
          </View>
          <View style={styles.fromBlock}>
            {settings?.businessName && <Text style={styles.businessName}>{settings.businessName}</Text>}
            {settings?.fullName && <Text style={{ marginBottom: 2 }}>{settings.fullName}</Text>}
            {settings?.email && <Text style={{ color: "#64748b" }}>{settings.email}</Text>}
            {settings?.address && <Text style={{ color: "#64748b", marginTop: 2 }}>{settings.address}</Text>}
            {settings?.phone && <Text style={{ color: "#64748b" }}>{settings.phone}</Text>}
          </View>
        </View>

        {/* Invoice meta */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.label}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
            {invoice.subject && <Text style={{ color: "#64748b", marginTop: 4 }}>{invoice.subject}</Text>}
          </View>
          <View>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={{ marginBottom: 8 }}>{new Date(invoice.issueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
            <Text style={styles.label}>Due Date</Text>
            <Text>{new Date(invoice.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, { color: "#94a3b8", fontSize: 8, textTransform: "uppercase" }]}>Description</Text>
            <Text style={[styles.colNum, { color: "#94a3b8", fontSize: 8, textTransform: "uppercase" }]}>Qty</Text>
            <Text style={[styles.colNum, { color: "#94a3b8", fontSize: 8, textTransform: "uppercase" }]}>Unit Price</Text>
            <Text style={[styles.colNum, { color: "#94a3b8", fontSize: 8, textTransform: "uppercase" }]}>Amount</Text>
          </View>
          {(invoice.items ?? []).map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colNum}>{item.quantity}</Text>
              <Text style={styles.colNum}>{formatMoney(item.unitPrice, invoice.currency)}</Text>
              <Text style={styles.colNum}>{formatMoney(item.amount, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatMoney(subtotal, invoice.currency)}</Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={styles.totalValue}>{formatMoney(taxAmount, invoice.currency)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={[styles.totalLabel, styles.totalFinal]}>Total</Text>
            <Text style={[styles.totalValue, styles.totalFinal]}>{formatMoney(total, invoice.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={[styles.label, { marginBottom: 6 }]}>Notes</Text>
            <Text style={{ color: "#64748b" }}>{invoice.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

export default function InvoicePDFPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invoices/${id}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([inv, sett]) => {
      setInvoice(inv);
      setSettings(sett);
    });
  }, [id]);

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <span className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <PDFViewer style={{ width: "100%", height: "100%" }}>
        <InvoicePDF invoice={invoice} settings={settings} />
      </PDFViewer>
    </div>
  );
}
