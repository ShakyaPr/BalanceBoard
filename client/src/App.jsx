import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  fetchAnalytics,
  fetchCardDetails,
  fetchDashboard,
  recordStatementPayment,
} from "./api.js";

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "2-digit",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const chartMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const cardVisuals = [
  { icon: "credit_card", tone: "primary" },
  { icon: "account_balance_wallet", tone: "secondary" },
  { icon: "savings", tone: "primary" },
  { icon: "workspace_premium", tone: "secondary" },
];

const navigationItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "analytics",
  },
];

function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0));
}

function renderExecutiveCurrency(value) {
  const parts = currencyFormatter.formatToParts(Number(value ?? 0));
  const currency = parts.find((part) => part.type === "currency")?.value ?? "LKR";
  const amount = parts
    .filter((part) => part.type !== "currency")
    .map((part) => part.value)
    .join("")
    .trim();

  return (
    <>
      <span className="executive-currency">{currency}</span>
      <span className="executive-currency-value">{amount}</span>
    </>
  );
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  return dateFormatter.format(new Date(value));
}

function formatMonth(value) {
  if (!value) {
    return "Unknown month";
  }

  return monthFormatter.format(new Date(value));
}

function formatChartMonth(value) {
  if (!value) {
    return "N/A";
  }

  return chartMonthFormatter.format(new Date(value));
}

function formatTimestamp(value) {
  if (!value) {
    return "No sync yet";
  }

  return timestampFormatter.format(new Date(value));
}

function startOfUtcDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getCardVisual(index) {
  return cardVisuals[index % cardVisuals.length];
}

function isAmountSettled(value) {
  return Number(value ?? 0) <= 0;
}

function getCardStatus(card) {
  if (isAmountSettled(card.totalPayable)) {
    return {
      label: "Paid",
      tone: "active",
      icon: "check_circle",
    };
  }

  if (isAmountSettled(card.amountDue)) {
    return {
      label: "Active",
      tone: "active",
      icon: "check_circle",
    };
  }

  if (!card.dueDate) {
    return {
      label: "Awaiting Date",
      tone: "neutral",
      icon: "schedule",
    };
  }

  const daysUntilDue = Math.ceil(
    (startOfUtcDay(card.dueDate) - startOfUtcDay(new Date())) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilDue < 0) {
    return {
      label: "Overdue",
      tone: "overdue",
      icon: "warning",
    };
  }

  if (daysUntilDue <= 7) {
    return {
      label: "Due Soon",
      tone: "soon",
      icon: "event_upcoming",
    };
  }

  return {
    label: "Active",
    tone: "active",
    icon: "check_circle",
  };
}

function getExecutiveNote(totals) {
  if (totals.nextDueDate) {
    return `Next due ${formatDate(totals.nextDueDate)}`;
  }

  if (totals.cardCount > 0) {
    return `${totals.cardCount} cards tracked`;
  }

  return "Waiting for imported statements";
}

function getTransactionIcon(description = "", type = "debit") {
  const normalizedDescription = description.toLowerCase();

  if (
    type === "credit" ||
    normalizedDescription.includes("payment") ||
    normalizedDescription.includes("refund") ||
    normalizedDescription.includes("wire")
  ) {
    return "payments";
  }

  if (
    normalizedDescription.includes("restaurant") ||
    normalizedDescription.includes("cafe") ||
    normalizedDescription.includes("food")
  ) {
    return "restaurant";
  }

  if (
    normalizedDescription.includes("flight") ||
    normalizedDescription.includes("airline") ||
    normalizedDescription.includes("travel")
  ) {
    return "flight_takeoff";
  }

  if (
    normalizedDescription.includes("market") ||
    normalizedDescription.includes("store") ||
    normalizedDescription.includes("shop")
  ) {
    return "shopping_bag";
  }

  if (normalizedDescription.includes("fuel") || normalizedDescription.includes("gas")) {
    return "local_gas_station";
  }

  return "credit_card";
}

function getAnalyticsTrend(summary) {
  if (!summary.latestMonthStart) {
    return {
      tone: "neutral",
      icon: "schedule",
      label: "Waiting for imported transactions",
    };
  }

  if (summary.monthOverMonthAmount === null) {
    return {
      tone: "neutral",
      icon: "insights",
      label: "First tracked month",
    };
  }

  if (summary.monthOverMonthAmount === 0) {
    return {
      tone: "neutral",
      icon: "trending_flat",
      label: "Flat versus last month",
    };
  }

  if (summary.monthOverMonthDirection === "down") {
    return {
      tone: "positive",
      icon: "trending_down",
      label:
        summary.monthOverMonthPercentage !== null
          ? `${Math.abs(summary.monthOverMonthPercentage).toFixed(1)}% lower than last month`
          : `${formatCurrency(Math.abs(summary.monthOverMonthAmount))} lower than last month`,
    };
  }

  return {
    tone: "caution",
    icon: "trending_up",
    label:
      summary.monthOverMonthPercentage !== null
        ? `${summary.monthOverMonthPercentage.toFixed(1)}% higher than last month`
        : `${formatCurrency(summary.monthOverMonthAmount)} higher than last month`,
  };
}

function readSelectedCardIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("card") ?? "";
}

function readSelectedViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "analytics" ? "analytics" : "dashboard";
}

function writeAppStateToUrl({ view = "dashboard", cardId = "" }) {
  const url = new URL(window.location.href);

  if (view === "analytics") {
    url.searchParams.set("view", "analytics");
  } else {
    url.searchParams.delete("view");
  }

  if (cardId) {
    url.searchParams.set("card", cardId);
  } else {
    url.searchParams.delete("card");
  }

  window.history.pushState({}, "", `${url.pathname}${url.search}`);
}

function LoadingCard({ kicker, title, description }) {
  return (
    <div className="loading-card">
      <p className="section-kicker">{kicker}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function SidebarNavigation({ selectedView, onNavigate }) {
  return (
    <>
      <div className="sidebar-brand">
        <h1>Private Ledger</h1>
        <p>Premium Tier</p>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-link ${selectedView === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}

function SummaryCard({
  card,
  index,
  onOpen,
  paymentDraft,
  paymentOpen,
  paymentSubmitting,
  paymentError,
  onTogglePayment,
  onPaymentDraftChange,
  onPaymentSubmit,
}) {
  const visual = getCardVisual(index);
  const status = getCardStatus(card);
  const paymentOptions = [
    {
      label: "Use minimum due",
      value: Number(card.amountDue ?? 0),
    },
    {
      label: "Use total payable",
      value: Number(card.totalPayable ?? 0),
    },
  ].filter((option, optionIndex, collection) => {
    if (option.value <= 0) {
      return false;
    }

    return collection.findIndex((candidate) => candidate.value === option.value) === optionIndex;
  });

  return (
    <article className="summary-card">
      <div className="summary-card-top">
        <div className="summary-card-identity">
          <div className={`summary-card-icon ${visual.tone}`}>
            <span className="material-symbols-outlined">{visual.icon}</span>
          </div>

          <div>
            <h3>{card.name}</h3>
            <p>{card.transactionCount} transactions in latest statement</p>
          </div>
        </div>

        <div className="summary-card-actions">
          <span className={`summary-status ${status.tone}`}>{status.label}</span>
          <button type="button" className="summary-action subtle" onClick={onTogglePayment}>
            <span className="material-symbols-outlined">payments</span>
            Track Paid Amount
          </button>
          <button type="button" className="summary-action" onClick={onOpen}>
            <span className="material-symbols-outlined">arrow_forward</span>
            View Details
          </button>
        </div>
      </div>

      <div className="summary-card-metrics">
        <div className="summary-metric">
          <span>Statement Date</span>
          <strong>{formatDate(card.statementDate)}</strong>
        </div>

        <div className="summary-metric">
          <span>Due Date</span>
          <strong>{formatDate(card.dueDate)}</strong>
        </div>

        <div className="summary-metric">
          <span>Total Payable</span>
          <strong>{formatCurrency(card.totalPayable)}</strong>
        </div>

        <div className="summary-metric">
          <span>Minimum Due Remaining</span>
          <strong className="metric-emphasis">{formatCurrency(card.amountDue)}</strong>
        </div>

        <div className="summary-metric">
          <span>Paid So Far</span>
          <strong>{formatCurrency(card.paidAmount)}</strong>
        </div>
      </div>

      {paymentOpen ? (
        <form
          className="payment-form"
          onSubmit={(event) => {
            event.preventDefault();
            onPaymentSubmit();
          }}
        >
          <div className="payment-quick-actions">
            {paymentOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className="payment-quick-action"
                onClick={() => onPaymentDraftChange(option.value.toFixed(2))}
              >
                <span>{option.label}</span>
                <strong>{formatCurrency(option.value)}</strong>
              </button>
            ))}
          </div>

          <label className="payment-field">
            <span>Manual paid amount</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={paymentDraft}
              onChange={(event) => onPaymentDraftChange(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <button type="submit" className="payment-submit" disabled={paymentSubmitting}>
            {paymentSubmitting ? "Saving..." : "Save Payment"}
          </button>

          {paymentError ? <p className="payment-error">{paymentError}</p> : null}
        </form>
      ) : null}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="empty-state-panel">
      <p className="section-kicker">Executive Overview</p>
      <h2>No card statements yet.</h2>
      <p>
        Post your statement payloads to the API and the overview will automatically populate with
        balances, due dates, and summary rows for each card.
      </p>
    </div>
  );
}

function OverviewPage({
  dashboard,
  searchQuery,
  filterQuery,
  setSearchQuery,
  onOpenCard,
  paymentDrafts,
  openPaymentStatementId,
  submittingPaymentStatementId,
  paymentErrors,
  onTogglePayment,
  onPaymentDraftChange,
  onRecordPayment,
}) {
  const totals = dashboard?.totals ?? {
    cardCount: 0,
    statementCount: 0,
    totalOutstanding: 0,
    totalDue: 0,
    totalTransactions: 0,
    monthlySpend: 0,
    monthlyCredits: 0,
    nextDueDate: null,
  };
  const cards = dashboard?.cards ?? [];
  const normalizedSearch = filterQuery.trim().toLowerCase();
  const filteredCards = cards.filter((card) => {
    if (!normalizedSearch) {
      return true;
    }

    return card.name.toLowerCase().includes(normalizedSearch);
  });

  return (
    <>
      <header className="overview-topbar">
        <div className="topbar-left">
          <label className="topbar-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>
      </header>

      <main className="overview-content">
        <section className="executive-header">
          <p className="section-kicker">Executive Overview</p>
          <h2>Total Amount to be Paid</h2>
          <div className="executive-amount-row">
            <strong>{renderExecutiveCurrency(totals.totalOutstanding)}</strong>
            <span className="executive-note">
              <span className="material-symbols-outlined">monitoring</span>
              {getExecutiveNote(totals)}
            </span>
          </div>

          <div className="executive-meta-grid">
            <div className="executive-meta-card">
              <span>Minimum due remaining</span>
              <strong>{formatCurrency(totals.totalDue)}</strong>
            </div>
            <div className="executive-meta-card">
              <span>Cards tracked</span>
              <strong>{totals.cardCount}</strong>
            </div>
            <div className="executive-meta-card">
              <span>Last synced</span>
              <strong>{formatTimestamp(dashboard?.generatedAt)}</strong>
            </div>
          </div>
        </section>

        <section className="summary-section">
          <div className="summary-section-header">
            <h3>Card Summaries</h3>
            <button type="button" className="summary-link-button" onClick={() => setSearchQuery("")}>
              View All Accounts
            </button>
          </div>

          {cards.length === 0 ? (
            <EmptyState />
          ) : filteredCards.length === 0 ? (
            <div className="empty-state-panel compact">
              <h2>No accounts matched your search.</h2>
              <p>Clear the search to bring all imported card summaries back into view.</p>
            </div>
          ) : (
            <div className="summary-list">
              {filteredCards.map((card, index) => (
                <SummaryCard
                  key={card.id}
                  card={card}
                  index={index}
                  onOpen={() => onOpenCard(card)}
                  paymentDraft={paymentDrafts[card.statementId] ?? ""}
                  paymentOpen={openPaymentStatementId === card.statementId}
                  paymentSubmitting={submittingPaymentStatementId === card.statementId}
                  paymentError={paymentErrors[card.statementId] ?? ""}
                  onTogglePayment={() => onTogglePayment(card.statementId)}
                  onPaymentDraftChange={(value) => onPaymentDraftChange(card.statementId, value)}
                  onPaymentSubmit={() => onRecordPayment(card)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function CardDetailsPage({
  detailCard,
  selectedStatementId,
  setSelectedStatementId,
  onBack,
  detailLoading,
  detailError,
}) {
  const statements = detailCard?.statements ?? [];
  const selectedStatement =
    statements.find((statement) => statement.statementId === selectedStatementId) ??
    statements[0] ??
    null;

  return (
    <>
      <header className="details-topbar">
        <button type="button" className="back-button" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Overview
        </button>
      </header>

      <main className="details-content">
        {detailLoading ? (
          <div className="empty-state-panel compact">
            <h2>Loading card details.</h2>
            <p>Preparing statement history and transactions for this card.</p>
          </div>
        ) : detailError ? (
          <div className="empty-state-panel compact">
            <h2>Unable to load card details.</h2>
            <p>{detailError}</p>
          </div>
        ) : !detailCard || !selectedStatement ? (
          <div className="empty-state-panel compact">
            <h2>No statement history found.</h2>
            <p>This card does not have any imported statements yet.</p>
          </div>
        ) : (
          <>
            <section className="details-header">
              <div>
                <p className="section-kicker">Card Details</p>
                <h2>{detailCard.cardName}</h2>
              </div>

              <label className="statement-select-field">
                <span>Statement Month</span>
                <select
                  value={selectedStatement.statementId}
                  onChange={(event) => setSelectedStatementId(event.target.value)}
                >
                  {statements.map((statement) => (
                    <option key={statement.statementId} value={statement.statementId}>
                      {formatMonth(statement.statementDate)}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="details-summary-grid">
              <article className="details-summary-card">
                <span>Total Payable</span>
                <strong>{formatCurrency(selectedStatement.totalPayable)}</strong>
              </article>

              <article className="details-summary-card">
                <span>Minimum Due Remaining</span>
                <strong>{formatCurrency(selectedStatement.amountDue)}</strong>
              </article>
            </section>

            <section className="details-transactions">
              <div className="details-section-header">
                <h3>Transactions</h3>
              </div>

              {selectedStatement.transactions.length === 0 ? (
                <div className="empty-state-panel compact">
                  <h2>No transactions in this statement.</h2>
                  <p>
                    The selected month exists, but it does not contain any imported transaction
                    rows.
                  </p>
                </div>
              ) : (
                <div className="activity-panel">
                  <div className="activity-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStatement.transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>{transaction.postedOnLabel}</td>
                            <td>
                              <div className="transaction-summary">
                                <span className={`transaction-summary-icon ${transaction.type}`}>
                                  <span className="material-symbols-outlined">
                                    {getTransactionIcon(transaction.description, transaction.type)}
                                  </span>
                                </span>
                                <div>
                                  <strong>{transaction.description}</strong>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`summary-status ${transaction.type}`}>
                                {transaction.type}
                              </span>
                            </td>
                            <td
                              className={
                                transaction.type === "credit" ? "amount-credit" : "amount-debit"
                              }
                            >
                              {formatCurrency(transaction.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function AnalyticsPage({ analytics, analyticsLoading, analyticsError }) {
  const summary = analytics?.summary ?? {
    monthsTracked: 0,
    latestMonthStart: null,
    latestMonthSpend: 0,
    previousMonthSpend: 0,
    highestMonthStart: null,
    highestMonthSpend: 0,
    averageMonthlySpend: 0,
    monthOverMonthAmount: null,
    monthOverMonthPercentage: null,
    monthOverMonthDirection: "flat",
  };
  const series = analytics?.series ?? [];
  const trend = getAnalyticsTrend(summary);
  const maxSpend = Math.max(...series.map((entry) => entry.totalSpend), 1);

  return (
    <>
      <header className="analytics-topbar">
        <div>
          <p className="section-kicker">Trend View</p>
          <h2>Analytics</h2>
        </div>

        <div className="analytics-period-pill">
          <span>Latest Month</span>
          <strong>
            {summary.latestMonthStart ? formatMonth(summary.latestMonthStart) : "No data yet"}
          </strong>
        </div>
      </header>

      <main className="analytics-content">
        {analyticsLoading && !analytics ? (
          <div className="empty-state-panel compact">
            <h2>Loading analytics.</h2>
            <p>Preparing your month-by-month spending trend from imported transactions.</p>
          </div>
        ) : analyticsError ? (
          <div className="empty-state-panel compact">
            <h2>Unable to load analytics.</h2>
            <p>{analyticsError}</p>
          </div>
        ) : series.length === 0 ? (
          <div className="empty-state-panel compact">
            <h2>No monthly spending data yet.</h2>
            <p>
              Import statements and the service will group debit transactions by posted month to
              build the spending trend automatically.
            </p>
          </div>
        ) : (
          <>
            <section className="analytics-hero-grid">
              <article className="analytics-hero-card">
                <p className="section-kicker">Latest Monthly Spending</p>
                <div className="analytics-hero-value-row">
                  <strong>{renderExecutiveCurrency(summary.latestMonthSpend)}</strong>
                  <span className={`analytics-trend-pill ${trend.tone}`}>
                    <span className="material-symbols-outlined">{trend.icon}</span>
                    {trend.label}
                  </span>
                </div>
                <p className="analytics-hero-caption">
                  Calculated from debit transactions posted in{" "}
                  {formatMonth(summary.latestMonthStart)}.
                </p>
              </article>

              <article className="analytics-stat-card">
                <span>Average month</span>
                <strong>{formatCurrency(summary.averageMonthlySpend)}</strong>
                <p>{summary.monthsTracked} tracked months</p>
              </article>

              <article className="analytics-stat-card">
                <span>Highest month</span>
                <strong>{formatCurrency(summary.highestMonthSpend)}</strong>
                <p>
                  {summary.highestMonthStart
                    ? formatMonth(summary.highestMonthStart)
                    : "No month yet"}
                </p>
              </article>
            </section>

            <section className="analytics-chart-card">
              <div className="analytics-chart-header">
                <div>
                  <h3>Spending Trend</h3>
                  <p>
                    Month-by-month totals are saved from transaction dates when each statement is
                    imported, even when a statement spans two months.
                  </p>
                </div>

                <div className="analytics-chart-legend">
                  <span className="analytics-chart-legend-dot"></span>
                  Stored monthly totals
                </div>
              </div>

              <div className="analytics-chart-scroll">
                <div className="analytics-chart">
                  {series.map((entry, index) => {
                    const height = Math.max(12, Math.round((entry.totalSpend / maxSpend) * 100));
                    const isLatest = index === series.length - 1;

                    return (
                      <div key={entry.monthStart} className="analytics-bar-column">
                        <span className={`analytics-bar-value ${isLatest ? "latest" : ""}`}>
                          {formatCurrency(entry.totalSpend)}
                        </span>

                        <div className="analytics-bar-track">
                          <div
                            className={`analytics-bar ${isLatest ? "latest" : ""}`}
                            style={{ height: `${height}%` }}
                          ></div>
                        </div>

                        <span className={`analytics-bar-label ${isLatest ? "latest" : ""}`}>
                          {formatChartMonth(entry.monthStart)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function App() {
  const [selectedView, setSelectedView] = useState(() => readSelectedViewFromUrl());
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(() => readSelectedCardIdFromUrl());
  const [detailCard, setDetailCard] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedStatementId, setSelectedStatementId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [paymentErrors, setPaymentErrors] = useState({});
  const [openPaymentStatementId, setOpenPaymentStatementId] = useState("");
  const [submittingPaymentStatementId, setSubmittingPaymentStatementId] = useState("");
  const mountedRef = useRef(true);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const snapshot = await fetchDashboard();

      if (mountedRef.current) {
        setDashboard(snapshot);
        setError("");
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setError(requestError.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function loadAnalytics({ silent = false } = {}) {
    if (!silent) {
      setAnalyticsLoading(true);
    }

    try {
      const snapshot = await fetchAnalytics();

      if (mountedRef.current) {
        setAnalytics(snapshot);
        setAnalyticsError("");
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setAnalyticsError(requestError.message);
      }
    } finally {
      if (mountedRef.current) {
        setAnalyticsLoading(false);
      }
    }
  }

  async function loadCardDetails(cardId) {
    if (!cardId || selectedView !== "dashboard") {
      setDetailCard(null);
      setDetailError("");
      setSelectedStatementId("");
      return;
    }

    setDetailLoading(true);

    try {
      const card = await fetchCardDetails(cardId);

      if (mountedRef.current) {
        setDetailCard(card);
        setSelectedStatementId((currentStatementId) =>
          card.statements.some((statement) => statement.statementId === currentStatementId)
            ? currentStatementId
            : (card.statements[0]?.statementId ?? ""),
        );
        setDetailError("");
      }
    } catch (requestError) {
      if (mountedRef.current) {
        setDetailError(requestError.message);
      }
    } finally {
      if (mountedRef.current) {
        setDetailLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    loadDashboard();
    loadAnalytics();

    const timer = setInterval(() => {
      loadDashboard({ silent: true });
      loadAnalytics({ silent: true });
    }, 30000);

    const handlePopState = () => {
      setSelectedView(readSelectedViewFromUrl());
      setSelectedCardId(readSelectedCardIdFromUrl());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    loadCardDetails(selectedCardId);
  }, [selectedCardId, selectedView]);

  const isDetailPage = selectedView === "dashboard" && Boolean(selectedCardId);

  function navigateToView(view) {
    setSelectedView(view);
    setSelectedCardId("");
    setDetailCard(null);
    setDetailError("");
    setSelectedStatementId("");
    writeAppStateToUrl({
      view,
      cardId: "",
    });
  }

  function openCard(card) {
    setSelectedView("dashboard");
    setSelectedCardId(card.id);
    setSelectedStatementId(card.statementId);
    writeAppStateToUrl({
      view: "dashboard",
      cardId: card.id,
    });
  }

  function closeCardDetails() {
    setSelectedCardId("");
    setDetailCard(null);
    setSelectedStatementId("");
    writeAppStateToUrl({
      view: "dashboard",
      cardId: "",
    });
  }

  function togglePayment(statementId) {
    setPaymentErrors((currentErrors) => ({
      ...currentErrors,
      [statementId]: "",
    }));
    setOpenPaymentStatementId((currentStatementId) =>
      currentStatementId === statementId ? "" : statementId,
    );
  }

  function updatePaymentDraft(statementId, value) {
    setPaymentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [statementId]: value,
    }));
  }

  async function handleRecordPayment(card) {
    const rawAmount = paymentDrafts[card.statementId] ?? "";
    const amount = Number(rawAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentErrors((currentErrors) => ({
        ...currentErrors,
        [card.statementId]: "Enter a valid paid amount greater than zero.",
      }));
      return;
    }

    setSubmittingPaymentStatementId(card.statementId);

    try {
      await recordStatementPayment(card.statementId, amount);
      setPaymentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [card.statementId]: "",
      }));
      setPaymentErrors((currentErrors) => ({
        ...currentErrors,
        [card.statementId]: "",
      }));
      setOpenPaymentStatementId("");
      await loadDashboard({ silent: true });

      if (selectedCardId === card.id) {
        await loadCardDetails(card.id);
      }
    } catch (requestError) {
      setPaymentErrors((currentErrors) => ({
        ...currentErrors,
        [card.statementId]: requestError.message,
      }));
    } finally {
      setSubmittingPaymentStatementId("");
    }
  }

  if (selectedView === "dashboard" && loading && !dashboard) {
    return (
      <div className="loading-screen">
        <LoadingCard
          kicker="Private Ledger"
          title="Loading overview dashboard."
          description="Preparing the latest balances and card summaries from your imported statements."
        />
      </div>
    );
  }

  return (
    <div className="overview-shell">
      <aside className="overview-sidebar">
        <SidebarNavigation selectedView={selectedView} onNavigate={navigateToView} />
      </aside>

      <div className="overview-main">
        {selectedView === "dashboard" && error ? (
          <div className="error-banner page-error">{error}</div>
        ) : null}

        {selectedView === "analytics" ? (
          <AnalyticsPage
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            analyticsError={analyticsError}
          />
        ) : isDetailPage ? (
          <CardDetailsPage
            detailCard={detailCard}
            selectedStatementId={selectedStatementId}
            setSelectedStatementId={setSelectedStatementId}
            onBack={closeCardDetails}
            detailLoading={detailLoading}
            detailError={detailError}
          />
        ) : (
          <OverviewPage
            dashboard={dashboard}
            searchQuery={searchQuery}
            filterQuery={deferredSearchQuery}
            setSearchQuery={setSearchQuery}
            onOpenCard={openCard}
            paymentDrafts={paymentDrafts}
            openPaymentStatementId={openPaymentStatementId}
            submittingPaymentStatementId={submittingPaymentStatementId}
            paymentErrors={paymentErrors}
            onTogglePayment={togglePayment}
            onPaymentDraftChange={updatePaymentDraft}
            onRecordPayment={handleRecordPayment}
          />
        )}
      </div>
    </div>
  );
}

export default App;
