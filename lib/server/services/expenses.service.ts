import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { Expense, ExpenseCategory } from '@/types';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { Timestamp } from 'firebase-admin/firestore';

const VALID_CATEGORIES: ExpenseCategory[] = [
  'salary',
  'utilities',
  'maintenance',
  'supplies',
  'food',
  'rent',
  'internet',
  'other',
];

export interface CreateExpenseInput {
  category: string;
  amountPaise: number;
  note?: string;
  vendor?: string;
  date: string; // YYYY-MM-DD
  propertyId?: string; // defaults to ownerId (primary property)
}

export class ExpensesService {
  async create(ownerId: string, recordedBy: string, input: CreateExpenseInput): Promise<Expense> {
    if (!input.amountPaise || input.amountPaise <= 0) {
      throw new AppError(400, 'Amount must be greater than zero');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new AppError(400, 'A valid date (YYYY-MM-DD) is required');
    }
    const category = (VALID_CATEGORIES as string[]).includes(input.category)
      ? (input.category as ExpenseCategory)
      : 'other';

    const ref = adminDb.collection('expenses').doc();
    const expense: Expense = {
      id: ref.id,
      ownerId,
      propertyId: input.propertyId || ownerId,
      category,
      amountPaise: Math.round(input.amountPaise),
      note: input.note?.trim().slice(0, 300) || undefined,
      vendor: input.vendor?.trim().slice(0, 120) || undefined,
      date: input.date,
      period: input.date.slice(0, 7),
      recordedBy,
      createdAt: Timestamp.now(),
    };

    await ref.set(expense);
    return expense;
  }

  async listByPeriod(ownerId: string, period: string, limitCount = 100): Promise<Expense[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('expenses')
      .where('ownerId', '==', ownerId)
      .where('period', '==', period)
      .orderBy('date', 'desc')
      .limit(safeLimit)
      .get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Expense));
  }

  /** Total expense paise for a period (used for net-revenue in analytics). */
  async totalForPeriod(ownerId: string, period: string): Promise<number> {
    const list = await this.listByPeriod(ownerId, period, MAX_LIST_LIMIT);
    return list.reduce((s, e) => s + (e.amountPaise || 0), 0);
  }

  async delete(ownerId: string, expenseId: string): Promise<void> {
    const ref = adminDb.collection('expenses').doc(expenseId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Expense not found');
    if ((snap.data() as Expense).ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    await ref.delete();
  }
}

export const expensesService = new ExpensesService();
