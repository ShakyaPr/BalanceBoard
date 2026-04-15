import { prisma } from "../db/prisma.js";
import { toIsoDate } from "../utils/date.js";
import { NotFoundError, RequestValidationError } from "../utils/errors.js";

function toNumber(value) {
  return Number(value ?? 0);
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

export async function upsertStatement(normalizedStatement) {
  return prisma.$transaction(async (transactionClient) => {
    const card = await transactionClient.creditCard.upsert({
      where: { name: normalizedStatement.cardName },
      update: {},
      create: {
        name: normalizedStatement.cardName,
      },
    });

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
