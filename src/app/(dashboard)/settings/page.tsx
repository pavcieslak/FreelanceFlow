"use client";

import { useState, useEffect, useRef } from "react";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import { Settings } from "@/types";
import { CURRENCIES, cn } from "@/lib/utils";

type InlineMessage = { type: "success" | "error"; text: string } | null;

function Msg({ msg }: { msg: InlineMessage }) {
  if (!msg) return null;
  return (
    <p className={cn("text-sm px-3 py-2 rounded border",
      msg.type === "success"
        ? "bg-success/10 border-success/30 text-success"
        : "bg-danger/10 border-danger/30 text-danger")}>
      {msg.text}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // My Details
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<InlineMessage>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Defaults
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("0");
  const [monthlyExpenses, setMonthlyExpenses] = useState("0");
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsMsg, setDefaultsMsg] = useState<InlineMessage>(null);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<InlineMessage>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setFullName(s.fullName ?? "");
        setBusinessName(s.businessName ?? "");
        setEmail(s.email ?? "");
        setAddress(s.address ?? "");
        setPhone(s.phone ?? "");
        setLogo(s.logo ?? null);
        setDefaultCurrency(s.defaultCurrency ?? "USD");
        setDefaultHourlyRate(String(s.defaultHourlyRate ?? 0));
        setMonthlyExpenses(String(s.monthlyExpenses ?? 0));
      })
      .finally(() => setLoading(false));
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveDetails() {
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, businessName, email, address, phone, logo }),
      });
      if (res.ok) {
        setDetailsMsg({ type: "success", text: "Details saved successfully." });
      } else {
        const d = await res.json();
        setDetailsMsg({ type: "error", text: d.error ?? "Failed to save." });
      }
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveDefaults() {
    setSavingDefaults(true);
    setDefaultsMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCurrency, defaultHourlyRate: parseFloat(defaultHourlyRate) || 0, monthlyExpenses: parseFloat(monthlyExpenses) || 0 }),
      });
      if (res.ok) {
        setDefaultsMsg({ type: "success", text: "Defaults saved." });
      } else {
        const d = await res.json();
        setDefaultsMsg({ type: "error", text: d.error ?? "Failed to save." });
      }
    } finally {
      setSavingDefaults(false);
    }
  }

  async function savePassword() {
    setPwdMsg(null);
    if (!currentPassword || !newPassword) {
      setPwdMsg({ type: "error", text: "All password fields are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwdMsg({ type: "success", text: "Password updated successfully." });
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        const d = await res.json();
        setPwdMsg({ type: "error", text: d.error ?? "Failed to update password." });
      }
    } finally {
      setSavingPwd(false);
    }
  }

  const inputClass = "w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm transition-colors";

  if (loading) return <div className="p-6 text-text-muted">Loading…</div>;

  return (
    <PageShell title="Settings">
      <div className="max-w-xl space-y-6">
        {/* My Details */}
        <Section title="My Details">
          <Field label="Full Name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Jane Smith" />
          </Field>
          <Field label="Business Name">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="Acme Studio" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jane@example.com" />
          </Field>
          <Field label="Address">
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={cn(inputClass, "resize-none")} placeholder="123 Main St&#10;City, Country" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+1 555 000 0000" />
          </Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {logo && (
                <img src={logo} alt="Logo" className="w-12 h-12 object-contain rounded border border-border bg-surface-elevated" />
              )}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded border border-border bg-surface-elevated text-text-muted hover:text-text-primary text-sm transition-colors">
                {logo ? "Change Logo" : "Upload Logo"}
              </button>
              {logo && (
                <button type="button" onClick={() => setLogo(null)}
                  className="px-3 py-2 rounded border border-danger/30 bg-danger/10 text-danger text-sm transition-colors">
                  Remove
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </div>
          </Field>
          <Msg msg={detailsMsg} />
          <Button onClick={saveDetails} loading={savingDetails}>Save Details</Button>
        </Section>

        {/* Defaults */}
        <Section title="Defaults">
          <Field label="Default Currency">
            <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}
              className={cn(inputClass, "appearance-none cursor-pointer")}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default Hourly Rate">
            <input type="number" value={defaultHourlyRate} onChange={(e) => setDefaultHourlyRate(e.target.value)} min="0" step="0.01" className={inputClass} />
          </Field>
          <Field label="Monthly Expenses">
            <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(e.target.value)} min="0" step="0.01" className={inputClass} placeholder="0" />
            <p className="text-xs text-text-muted mt-1">Used to calculate your financial runway.</p>
          </Field>
          <Msg msg={defaultsMsg} />
          <Button onClick={saveDefaults} loading={savingDefaults}>Save Defaults</Button>
        </Section>

        {/* Security */}
        <Section title="Change Password">
          <Field label="Current Password">
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </Field>
          <Field label="New Password">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </Field>
          <Msg msg={pwdMsg} />
          <Button onClick={savePassword} loading={savingPwd}>Update Password</Button>
        </Section>
      </div>
    </PageShell>
  );
}
