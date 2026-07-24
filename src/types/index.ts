export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface Settings {
  id: string;
  userId?: string;
  fullName: string | null;
  businessName: string | null;
  email: string | null;
  address: string | null;
  phone: string | null;
  logo: string | null;
  defaultCurrency: string;
  defaultHourlyRate: number;
  monthlyExpenses: number;
}

export interface Client {
  id: string;
  clockifyClientId?: string | null;
  name: string;
  email: string | null;
  address: string | null;
  currency: string;
  archived: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  clientId: string | null;
  hourlyRate: number;
  currency: string;
  billableByDefault: boolean;
  archived: boolean;
  createdAt: string;
  client?: Client | null;
  _count?: { timeEntries: number };
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  archived: boolean;
}

export interface Tag {
  id: string;
  name: string;
  _count?: { timeEntries: number };
}

export interface TimeEntry {
  id: string;
  description: string | null;
  projectId: string | null;
  taskId: string | null;
  mode: "TIMER" | "HALF_DAY" | "FULL_DAY";
  isPlanned: boolean;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  invoiced: boolean;
  createdAt: string;
  project?: Project | null;
  task?: Task | null;
  tags?: Array<{ tag: Tag }>;
}

export interface Invoice {
  id: string;
  clockifyInvoiceId?: string | null;
  number: string;
  clientId: string;
  status: "DRAFT" | "SENT" | "PAID";
  issueDate: string;
  dueDate: string | null;
  subject: string | null;
  notes: string | null;
  currency: string;
  taxRate: number;
  paidAmount?: number;
  balanceAmount?: number;
  sentAt?: string | null;
  paidAt?: string | null;
  paymentUrl?: string | null;
  createdAt: string;
  client?: Client;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  timeEntryId: string | null;
  timeEntry?: TimeEntry | null;
}

export interface ReportFilters {
  dateRange: string;
  startDate: string;
  endDate: string;
  projectIds: string[];
  clientIds: string[];
  billable: string;
}

export interface ReportData {
  entries: TimeEntry[];
  totalDuration: number;
  billableDuration: number;
  totalAmount: number;
  currencyTotals: Record<string, number>;
  dailyBreakdown: Array<{ date: string; duration: number; amount: number }>;
}
