from fastapi import APIRouter, Query
from typing import Optional
from datetime import date, timedelta
from sqlalchemy import text

from db import get_session

router = APIRouter()

# Loan status 300 = Active in Fineract
_ACTIVE = 300
# Transaction type 1 = Disbursement
_DISBURSEMENT = 1


# ── Overdue helper CTE ───────────────────────────────────────────────────────
# Reused across multiple queries.
# BIT columns (completed_derived, is_reversed, etc.) are stored as BOOLEAN
# in Fineract's PostgreSQL schema via Liquibase type mapping.
_OVERDUE_CTE = """
overdue_schedule AS (
    SELECT
        loan_id,
        MIN(duedate)                         AS oldest_overdue_date,
        DATEDIFF(CURRENT_DATE, MIN(duedate)) AS days_in_arrears,
        SUM(
            COALESCE(principal_amount,                    0) - COALESCE(principal_completed_derived,       0)
                                                             - COALESCE(principal_writtenoff_derived,      0)
          + COALESCE(interest_amount,                    0) - COALESCE(interest_completed_derived,        0)
                                                             - COALESCE(interest_writtenoff_derived,      0)
                                                             - COALESCE(interest_waived_derived,          0)
          + COALESCE(fee_charges_amount,                 0) - COALESCE(fee_charges_completed_derived,     0)
                                                             - COALESCE(fee_charges_waived_derived,       0)
                                                             - COALESCE(fee_charges_writtenoff_derived,   0)
          + COALESCE(penalty_charges_amount,             0) - COALESCE(penalty_charges_completed_derived, 0)
                                                             - COALESCE(penalty_charges_waived_derived,   0)
                                                             - COALESCE(penalty_charges_writtenoff_derived,0)
        )                                    AS overdue_amount
    FROM m_loan_repayment_schedule
    WHERE duedate < CURRENT_DATE
      AND completed_derived = false
      AND obligations_met_on_date IS NULL
    GROUP BY loan_id
)
"""


@router.get("/summary")
async def portfolio_summary():
    """
    Loan portfolio summary with PAR0 and PAR30 calculated directly from
    the Fineract repayment schedule, not from derived API fields.
    """
    sql = text(f"""
        WITH {_OVERDUE_CTE}
        SELECT
            COUNT(l.id)                                                             AS active_loans,
            COUNT(DISTINCT l.client_id)                                             AS active_clients,
            COALESCE(SUM(l.principal_disbursed_derived),     0)                     AS total_disbursed,
            COALESCE(SUM(l.total_outstanding_derived),       0)                     AS total_outstanding,
            COALESCE(SUM(COALESCE(o.overdue_amount, 0)),     0)                     AS total_overdue,

            -- PAR0: any overdue / total outstanding
            CASE WHEN SUM(l.total_outstanding_derived) > 0
                 THEN ROUND(
                        COALESCE(SUM(CASE WHEN o.loan_id IS NOT NULL
                                         THEN l.total_outstanding_derived ELSE 0 END), 0)
                        / SUM(l.total_outstanding_derived) * 100, 2)
                 ELSE 0
            END                                                                     AS par0,

            -- PAR30: >= 30 days overdue / total outstanding
            CASE WHEN SUM(l.total_outstanding_derived) > 0
                 THEN ROUND(
                        COALESCE(SUM(CASE WHEN COALESCE(o.days_in_arrears, 0) >= 30
                                         THEN l.total_outstanding_derived ELSE 0 END), 0)
                        / SUM(l.total_outstanding_derived) * 100, 2)
                 ELSE 0
            END                                                                     AS par30,

            -- PAR90
            CASE WHEN SUM(l.total_outstanding_derived) > 0
                 THEN ROUND(
                        COALESCE(SUM(CASE WHEN COALESCE(o.days_in_arrears, 0) >= 90
                                         THEN l.total_outstanding_derived ELSE 0 END), 0)
                        / SUM(l.total_outstanding_derived) * 100, 2)
                 ELSE 0
            END                                                                     AS par90,

            l.currency_code                                                         AS currency
        FROM m_loan l
        LEFT JOIN overdue_schedule o ON l.id = o.loan_id
        WHERE l.loan_status_id = :status
        GROUP BY l.currency_code
    """)

    async with get_session() as db:
        result = await db.execute(sql, {"status": _ACTIVE})
        rows = result.mappings().all()

    if not rows:
        return {
            "activeLoans": 0, "activeClients": 0,
            "totalDisbursed": 0, "totalOutstanding": 0, "totalOverdue": 0,
            "par0": 0.0, "par30": 0.0, "par90": 0.0, "currency": "MMK",
        }

    # Aggregate across currencies (MFIs typically operate in a single currency)
    row = rows[0]
    return {
        "activeLoans":      int(row["active_loans"]),
        "activeClients":    int(row["active_clients"]),
        "totalDisbursed":   float(row["total_disbursed"]),
        "totalOutstanding": float(row["total_outstanding"]),
        "totalOverdue":     float(row["total_overdue"]),
        "par0":             float(row["par0"]),
        "par30":            float(row["par30"]),
        "par90":            float(row["par90"]),
        "currency":         row["currency"] or "MMK",
    }


@router.get("/by-product")
async def portfolio_by_product():
    """Outstanding loan portfolio grouped by loan product."""
    sql = text(f"""
        WITH {_OVERDUE_CTE}
        SELECT
            p.name                                              AS product_name,
            COUNT(l.id)                                         AS loan_count,
            COALESCE(SUM(l.total_outstanding_derived), 0)       AS outstanding,
            COALESCE(SUM(COALESCE(o.overdue_amount, 0)), 0)     AS overdue,
            CASE WHEN SUM(l.total_outstanding_derived) > 0
                 THEN ROUND(
                        COALESCE(SUM(COALESCE(o.overdue_amount, 0)), 0)
                        / SUM(l.total_outstanding_derived) * 100, 2)
                 ELSE 0
            END                                                 AS par_ratio
        FROM m_loan l
        JOIN m_product_loan p ON l.product_id = p.id
        LEFT JOIN overdue_schedule o ON l.id = o.loan_id
        WHERE l.loan_status_id = :status
        GROUP BY p.id, p.name
        ORDER BY outstanding DESC
    """)

    async with get_session() as db:
        result = await db.execute(sql, {"status": _ACTIVE})
        rows = result.mappings().all()

    return [
        {
            "productName": r["product_name"],
            "loanCount":   int(r["loan_count"]),
            "outstanding": float(r["outstanding"]),
            "overdue":     float(r["overdue"]),
            "parRatio":    float(r["par_ratio"]),
        }
        for r in rows
    ]


@router.get("/disbursements")
async def disbursements_over_time(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date:   Optional[str] = Query(None, alias="to"),
    granularity: str = Query("month", enum=["day", "week", "month"]),
):
    """
    Time-series of disbursements (count + amount) for charting.
    Defaults to the last 12 months if no date range is supplied.
    """
    end   = date.fromisoformat(to_date)   if to_date   else date.today()
    start = date.fromisoformat(from_date) if from_date else end - timedelta(days=365)

    trunc_expr = {
        "day":   "DATE(transaction_date)",
        "week":  "DATE(DATE_SUB(transaction_date, INTERVAL WEEKDAY(transaction_date) DAY))",
        "month": "DATE_SUB(transaction_date, INTERVAL DAY(transaction_date)-1 DAY)",
    }[granularity]

    sql = text(f"""
        SELECT
            {trunc_expr}                                 AS period,
            COUNT(DISTINCT loan_id)                      AS loan_count,
            COALESCE(SUM(amount), 0)                     AS amount
        FROM m_loan_transaction
        WHERE transaction_type_enum = :tx_type
          AND is_reversed               = false
          AND manually_adjusted_or_reversed = false
          AND transaction_date BETWEEN :start AND :end
        GROUP BY {trunc_expr}
        ORDER BY period
    """)

    async with get_session() as db:
        result = await db.execute(sql, {
            "tx_type": _DISBURSEMENT,
            "start":   start,
            "end":     end,
        })
        rows = result.mappings().all()

    return [
        {
            "period":    r["period"].isoformat(),
            "loanCount": int(r["loan_count"]),
            "amount":    float(r["amount"]),
        }
        for r in rows
    ]
