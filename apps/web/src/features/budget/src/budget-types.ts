export type AccountType = 'cash' | 'bank' | 'savings' | 'ewallet' | 'credit' | 'loan';
export type CategoryKind = 'income' | 'expense';
export type EntryKind = CategoryKind | 'transfer';

// Every amount is whole cents of the budget's currency.
export type BudgetAccount = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  // Debt details: yearly interest in basis points (1999 is 19.99%), the monthly due day (-1 for the last day), the minimum payment.
  aprBps: number | null;
  dueDay: number | null;
  minimumPayment: number | null;
  // Null means the budget's own currency.
  currency: string | null;
  // A preset logo key from brand-icons.ts, or null for the account type's icon.
  icon: string | null;
};
export type BudgetCategory = { id: string; name: string; kind: CategoryKind; monthlyLimit: number | null };
export type BudgetEntry = {
  id: string;
  kind: EntryKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  day: string;
  note: string;
  // What a transfer delivered when the two accounts use different currencies.
  toAmount: number | null;
  // An optional preset logo key; entries from a schedule fall back to the schedule's.
  icon: string | null;
  scheduleId: string | null;
  occurrenceDay: string | null;
  createdAt: string;
};

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

// A repeating entry. Occurrences before activeFrom or from pausedFrom on don't happen; monthDays uses -1 for the last day.
export type BudgetSchedule = {
  id: string;
  name: string;
  kind: EntryKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  frequency: Frequency;
  interval: number;
  monthDays: number[];
  startDay: string;
  endDay: string | null;
  activeFrom: string;
  pausedFrom: string | null;
  skippedDays: string[];
  autoRecord: boolean;
  isSubscription: boolean;
  icon: string | null;
};

export type BudgetGoal = { id: string; name: string; target: number; targetDay: string | null };
export type GoalContribution = { id: string; goalId: string; amount: number; day: string; note: string };

export type Budget = {
  currency: string;
  lowBalance: number;
  // How much one unit of each other currency is worth in the budget's currency.
  rates: Record<string, number>;
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  schedules: BudgetSchedule[];
  goals: BudgetGoal[];
  contributions: GoalContribution[];
  // Entries with a receipt photo attached.
  receiptEntryIds: string[];
  // Whether the server has Gemini set up for scanning, categorising and check-ins.
  aiEnabled: boolean;
};

export type BudgetSettings = Pick<Budget, 'currency' | 'lowBalance' | 'rates'>;

export type EntryInput = Omit<BudgetEntry, 'id' | 'createdAt' | 'scheduleId' | 'occurrenceDay'>;
export type ScheduleInput = Omit<BudgetSchedule, 'id'>;
export type OccurrenceLink = { scheduleId: string; occurrenceDay: string };

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank account' },
  { id: 'savings', label: 'Savings' },
  { id: 'ewallet', label: 'E-wallet' },
  { id: 'credit', label: 'Credit card' },
  { id: 'loan', label: 'Loan' },
];

export const BUDGET_VIEWS = ['overview', 'transactions', 'calendar', 'recurring', 'budgets', 'goals', 'debts', 'forecast', 'reports', 'settings'] as const;
export type BudgetView = (typeof BUDGET_VIEWS)[number];

export const DEBT_TYPES: AccountType[] = ['credit', 'loan'];

export type ReceiptImage = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
export type ReceiptScan = { merchant: string | null; amount: number | null; currency: string | null; day: string | null; categoryId: string | null };
export type Insights = { headline: string; points: string[] };
