import { prisma } from "../db/prisma.js";
import { getUtcMonthStart, inferTransactionDate, toIsoDate } from "../utils/date.js";
import { NotFoundError, RequestValidationError } from "../utils/errors.js";

function toNumber(value) {
  return Number(value ?? 0);
}

function roundCurrency(value) {
  return Number(toNumber(value).toFixed(2));
}

function summarizeTransactions(transactions) {
  return transactions.reduce(
    (summary, transaction) => {
      const amount = toNumber(transaction.amount);

      if (transaction.type === "debit") {
        summary.debitTotal += amount;
      } else {
        summary.creditTotal += Math.abs(amount);
      }

      return summary;
    },
    {
      debitTotal: 0,
      creditTotal: 0,
    },
  );
}

function mapTransaction(transaction, context = {}) {
  return {
    id: transaction.id,
    cardName: context.cardName,
    statementId: transaction.statementId,
    statementDate: context.statementDate ? toIsoDate(context.statementDate) : undefined,
    postedOnLabel: transaction.postedOnLabel,
    postedOnDate: transaction.postedOnDate ? toIsoDate(transaction.postedOnDate) : undefined,
    description: transaction.description,
    amount: toNumber(transaction.amount),
    type: transaction.type,
    position: transaction.position,
  };
}

function mapStatement(statement) {
  const transactions = statement.transactions.map((transaction) =>
    mapTransaction(transaction, {
      cardName: statement.creditCard.name,
      statementDate: statement.statementDate,
    }),
  );
  const transactionSummary = summarizeTransactions(statement.transactions);
  const originalTotalPayable = toNumber(statement.totalPayable);
  const originalAmountDue = toNumber(statement.amountDue);
  const paidAmount = toNumber(statement.paidAmount);
  const remainingPayable = Math.max(0, originalTotalPayable - paidAmount);
  const remainingAmountDue = Math.max(0, originalAmountDue - paidAmount);

  return {
    statementId: statement.id,
    cardId: statement.creditCardId,
    cardName: statement.creditCard.name,
    statementDate: toIsoDate(statement.statementDate),
    dueDate: toIsoDate(statement.dueDate),
    totalPayable: remainingPayable,
    amountDue: remainingAmountDue,
    originalTotalPayable,
    originalAmountDue,
    paidAmount,
    remainingPayable,
    remainingAmountDue,
    transactionCount: transactions.length,
    debitTotal: transactionSummary.debitTotal,
    creditTotal: transactionSummary.creditTotal,
    netSpend: transactionSummary.debitTotal - transactionSummary.creditTotal,
    importedAt: toIsoDate(statement.importedAt),
    transactions,
  };
}

function compareStatementsByRecency(left, right) {
  const statementDateDifference =
    new Date(right.statementDate).getTime() - new Date(left.statementDate).getTime();

  if (statementDateDifference !== 0) {
    return statementDateDifference;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function getNextUtcMonthStart(value) {
  const monthStart = getUtcMonthStart(value);
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
}

function getTransactionPostedOnDate(transaction, statementDate) {
  if (transaction.postedOnDate) {
    return new Date(transaction.postedOnDate);
  }

  return inferTransactionDate({
    statementDate,
    month: transaction.postedOnMonth,
    day: transaction.postedOnDay,
  });
}

function getUniqueMonthStarts(values) {
  const monthsByKey = new Map();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const monthStart = getUtcMonthStart(value);
    monthsByKey.set(monthStart.toISOString(), monthStart);
  }

  return [...monthsByKey.values()].sort((left, right) => left.getTime() - right.getTime());
}

async function recalculateMonthlySpendingForMonths(transactionClient, monthStarts) {
  for (const monthStart of getUniqueMonthStarts(monthStarts)) {
    const monthEnd = getNextUtcMonthStart(monthStart);
    const transactions = await transactionClient.cardTransaction.findMany({
      where: {
        type: "debit",
        postedOnDate: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        amount: true,
      },
    });

    const totalSpend = roundCurrency(
      transactions.reduce((summary, transaction) => summary + toNumber(transaction.amount), 0),
    );

    if (totalSpend > 0) {
      await transactionClient.monthlySpending.upsert({
        where: {
          monthStart,
        },
        update: {
          totalSpend,
        },
        create: {
          monthStart,
          totalSpend,
        },
      });
      continue;
    }

    await transactionClient.monthlySpending.deleteMany({
      where: {
        monthStart,
      },
    });
  }
}

async function backfillMissingTransactionDates(transactionClient) {
  const transactionsMissingDates = await transactionClient.cardTransaction.findMany({
    where: {
      postedOnDate: null,
    },
    select: {
      id: true,
      postedOnMonth: true,
      postedOnDay: true,
      statement: {
        select: {
          statementDate: true,
        },
      },
    },
  });

  for (const transaction of transactionsMissingDates) {
    await transactionClient.cardTransaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        postedOnDate: inferTransactionDate({
          statementDate: transaction.statement.statementDate,
          month: transaction.postedOnMonth,
          day: transaction.postedOnDay,
        }),
      },
    });
  }

  return transactionsMissingDates.length;
}

async function rebuildMonthlySpending(transactionClient) {
  const debitTransactions = await transactionClient.cardTransaction.findMany({
    where: {
      type: "debit",
    },
    select: {
      postedOnDate: true,
      postedOnMonth: true,
      postedOnDay: true,
      amount: true,
      statement: {
        select: {
          statementDate: true,
        },
      },
    },
  });

  const totalsByMonth = new Map();

  for (const transaction of debitTransactions) {
    const postedOnDate = getTransactionPostedOnDate(
      transaction,
      transaction.statement.statementDate,
    );
    const monthStart = getUtcMonthStart(postedOnDate);
    const monthKey = monthStart.toISOString();
    const currentTotal = totalsByMonth.get(monthKey)?.totalSpend ?? 0;

    totalsByMonth.set(monthKey, {
      monthStart,
      totalSpend: currentTotal + toNumber(transaction.amount),
    });
  }

  await transactionClient.monthlySpending.deleteMany({});

  const monthlySpendingRows = [...totalsByMonth.values()]
    .sort((left, right) => left.monthStart.getTime() - right.monthStart.getTime())
    .map((entry) => ({
      monthStart: entry.monthStart,
      totalSpend: roundCurrency(entry.totalSpend),
    }));

  if (monthlySpendingRows.length > 0) {
    await transactionClient.monthlySpending.createMany({
      data: monthlySpendingRows,
    });
  }
}

async function ensureMonthlySpendingIsReady(transactionClient) {
  const missingTransactionDateCount = await backfillMissingTransactionDates(transactionClient);
  const monthlySpendingCount = await transactionClient.monthlySpending.count();

  if (missingTransactionDateCount > 0 || monthlySpendingCount === 0) {
    await rebuildMonthlySpending(transactionClient);
  }
}

export async function upsertStatement(normalizedStatement) {
  return prisma.$transaction(async (transactionClient) => {
    const card = await transactionClient.creditCard.upsert({
      where: { name: normalizedStatement.cardName },
      update: {},
      create: {
        name: normalizedStatement.cardName,
      },
    });
    const missingTransactionDateCount = await backfillMissingTransactionDates(transactionClient);
    const monthlySpendingCount = await transactionClient.monthlySpending.count();
    const requiresFullMonthlyRebuild =
      missingTransactionDateCount > 0 || monthlySpendingCount === 0;

    const existingStatement = await transactionClient.cardStatement.findUnique({
      where: {
        creditCardId_statementDate: {
          creditCardId: card.id,
          statementDate: normalizedStatement.statementDate,
        },
      },
      select: {
        statementDate: true,
        transactions: {
          select: {
            postedOnDate: true,
            postedOnMonth: true,
            postedOnDay: true,
          },
        },
      },
    });

    const existingMonthStarts =
      existingStatement?.transactions.map((transaction) =>
        getTransactionPostedOnDate(transaction, existingStatement.statementDate),
      ) ?? [];
    const nextMonthStarts = normalizedStatement.transactions.map(
      (transaction) => transaction.postedOnDate,
    );
    const updateTransactions = {
      deleteMany: {},
      ...(normalizedStatement.transactions.length > 0
        ? { create: normalizedStatement.transactions }
        : {}),
    };
    const createTransactions =
      normalizedStatement.transactions.length > 0
        ? { transactions: { create: normalizedStatement.transactions } }
        : {};

    const statement = await transactionClient.cardStatement.upsert({
      where: {
        creditCardId_statementDate: {
          creditCardId: card.id,
          statementDate: normalizedStatement.statementDate,
        },
      },
      update: {
        rawStatementDate: normalizedStatement.rawStatementDate,
        rawDueDate: normalizedStatement.rawDueDate,
        dueDate: normalizedStatement.dueDate,
        totalPayable: normalizedStatement.totalPayable,
        amountDue: normalizedStatement.amountDue,
        importedAt: new Date(),
        transactions: updateTransactions,
      },
      create: {
        creditCardId: card.id,
        rawStatementDate: normalizedStatement.rawStatementDate,
        statementDate: normalizedStatement.statementDate,
        rawDueDate: normalizedStatement.rawDueDate,
        dueDate: normalizedStatement.dueDate,
        totalPayable: normalizedStatement.totalPayable,
        amountDue: normalizedStatement.amountDue,
        paidAmount: 0,
        ...createTransactions,
      },
      include: {
        creditCard: true,
        transactions: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (requiresFullMonthlyRebuild) {
      await rebuildMonthlySpending(transactionClient);
    } else {
      await recalculateMonthlySpendingForMonths(transactionClient, [
        ...existingMonthStarts,
        ...nextMonthStarts,
      ]);
    }

    return mapStatement(statement);
  });
}

export async function getDashboardSnapshot() {
  const cards = await prisma.creditCard.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      _count: {
        select: {
          statements: true,
        },
      },
      statements: {
        orderBy: [
          { statementDate: "desc" },
          { createdAt: "desc" },
        ],
        take: 1,
        include: {
          creditCard: true,
          transactions: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });

  const latestCardSnapshots = cards
    .map((card) => {
      const latestStatement = [...card.statements].sort(compareStatementsByRecency)[0];

      if (!latestStatement) {
        return null;
      }

      const mappedStatement = mapStatement(latestStatement);

      return {
        id: card.id,
        name: card.name,
        statementsTracked: card._count.statements,
        ...mappedStatement,
      };
    })
    .filter(Boolean);

  const recentTransactions = latestCardSnapshots
    .flatMap((card) => card.transactions)
    .sort((left, right) => {
      const statementDateDifference =
        new Date(right.statementDate).getTime() - new Date(left.statementDate).getTime();

      if (statementDateDifference !== 0) {
        return statementDateDifference;
      }

      return left.position - right.position;
    })
    .slice(0, 12);

  const nextDueDate = latestCardSnapshots
    .map((card) => card.dueDate)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];

  const totals = latestCardSnapshots.reduce(
    (summary, card) => {
      summary.cardCount += 1;
      summary.statementCount += card.statementsTracked;
      summary.totalOutstanding += card.remainingPayable;
      summary.totalDue += card.remainingAmountDue;
      summary.totalTransactions += card.transactionCount;
      summary.monthlySpend += card.debitTotal;
      summary.monthlyCredits += card.creditTotal;
      return summary;
    },
    {
      cardCount: 0,
      statementCount: 0,
      totalOutstanding: 0,
      totalDue: 0,
      totalTransactions: 0,
      monthlySpend: 0,
      monthlyCredits: 0,
      nextDueDate: nextDueDate ?? null,
    },
  );

  totals.nextDueDate = nextDueDate ?? null;

  return {
    generatedAt: new Date().toISOString(),
    totals,
    cards: latestCardSnapshots,
    recentTransactions,
  };
}

export async function getAnalyticsSnapshot() {
  return prisma.$transaction(async (transactionClient) => {
    await ensureMonthlySpendingIsReady(transactionClient);

    const spendingSeries = await transactionClient.monthlySpending.findMany({
      orderBy: {
        monthStart: "asc",
      },
    });
    const series = spendingSeries.map((entry) => ({
      monthStart: toIsoDate(entry.monthStart),
      totalSpend: toNumber(entry.totalSpend),
    }));
    const latestMonth = series[series.length - 1] ?? null;
    const previousMonth = series[series.length - 2] ?? null;
    const highestMonth = series.reduce(
      (highestEntry, entry) =>
        !highestEntry || entry.totalSpend > highestEntry.totalSpend ? entry : highestEntry,
      null,
    );
    const averageMonthlySpend =
      series.length > 0
        ? roundCurrency(
            series.reduce((summary, entry) => summary + entry.totalSpend, 0) / series.length,
          )
        : 0;
    const monthOverMonthAmount =
      latestMonth && previousMonth
        ? roundCurrency(latestMonth.totalSpend - previousMonth.totalSpend)
        : null;
    const monthOverMonthPercentage =
      previousMonth && previousMonth.totalSpend > 0 && monthOverMonthAmount !== null
        ? roundCurrency((monthOverMonthAmount / previousMonth.totalSpend) * 100)
        : null;
    const monthOverMonthDirection =
      monthOverMonthAmount === null || monthOverMonthAmount === 0
        ? "flat"
        : monthOverMonthAmount > 0
          ? "up"
          : "down";

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        monthsTracked: series.length,
        latestMonthStart: latestMonth?.monthStart ?? null,
        latestMonthSpend: latestMonth?.totalSpend ?? 0,
        previousMonthSpend: previousMonth?.totalSpend ?? 0,
        highestMonthStart: highestMonth?.monthStart ?? null,
        highestMonthSpend: highestMonth?.totalSpend ?? 0,
        averageMonthlySpend,
        monthOverMonthAmount,
        monthOverMonthPercentage,
        monthOverMonthDirection,
      },
      series,
    };
  });
}

export async function getCardDetails(cardId) {
  const card = await prisma.creditCard.findUnique({
    where: {
      id: cardId,
    },
    include: {
      statements: {
        orderBy: [
          { statementDate: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          creditCard: true,
          transactions: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });

  if (!card) {
    throw new NotFoundError("Card not found.");
  }

  const statements = [...card.statements]
    .sort(compareStatementsByRecency)
    .map((statement) => mapStatement(statement));

  return {
    cardId: card.id,
    cardName: card.name,
    statements,
  };
}

export async function recordStatementPayment(statementId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RequestValidationError("Payment amount must be greater than zero.");
  }

  return prisma.$transaction(async (transactionClient) => {
    const existingStatement = await transactionClient.cardStatement.findUnique({
      where: {
        id: statementId,
      },
    });

    if (!existingStatement) {
      throw new NotFoundError("Statement not found.");
    }

    const currentPaidAmount = toNumber(existingStatement.paidAmount);
    const statementTotal = toNumber(existingStatement.totalPayable);
    const nextPaidAmount = Math.min(statementTotal, currentPaidAmount + amount);

    const statement = await transactionClient.cardStatement.update({
      where: {
        id: statementId,
      },
      data: {
        paidAmount: nextPaidAmount,
      },
      include: {
        creditCard: true,
        transactions: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    return mapStatement(statement);
  });
}
