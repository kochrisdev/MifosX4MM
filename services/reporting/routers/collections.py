from fastapi import APIRouter, Query
from typing import Optional
from sqlalchemy import text

from db import get_session

router = APIRouter()

# transaction_type_enum = 2 → repayment in Fineract
_REPAYMENT = 2
_ACTIVE = 300


@router.get("/today")
async def collections_today():
    """
    Repayments received today vs. installments scheduled for today.
    Uses the Fineract PostgreSQL schema directly.
    """
    collected_sql = text("""
        SELECT COALESCE(SUM(amount), 0) AS collected
        FROM   m_loan_transaction
        WHERE  transaction_type_enum          = :tx_type
          AND  transaction_date               = CURRENT_DATE
          AND  is_reversed                    = false
          AND  manually_adjusted_or_reversed  = false
    """)

    scheduled_sql = text("""
        SELECT COALESCE(SUM(
            COALESCE(lrs.principal_amount,       0) - COALESCE(lrs.principal_completed_derived,       0)
          + COALESCE(lrs.interest_amount,        0) - COALESCE(lrs.interest_completed_derived,        0)
                                                   - COALESCE(lrs.interest_waived_derived,            0)
          + COALESCE(lrs.fee_charges_amount,     0) - COALESCE(lrs.fee_charges_completed_derived,     0)
                                                   - COALESCE(lrs.fee_charges_waived_derived,         0)
          + COALESCE(lrs.penalty_charges_amount, 0) - COALESCE(lrs.penalty_charges_completed_derived, 0)
                                                   - COALESCE(lrs.penalty_charges_waived_derived,     0)
        ), 0) AS scheduled
        FROM  m_loan_repayment_schedule lrs
        JOIN  m_loan l ON l.id = lrs.loan_id
        WHERE lrs.duedate        = CURRENT_DATE
          AND l.loan_status_id   = :status
          AND lrs.completed_derived = false
    """)

    async with get_session() as db:
        c_row = (await db.execute(collected_sql, {"tx_type": _REPAYMENT})).mappings().one()
        s_row = (await db.execute(scheduled_sql, {"status": _ACTIVE})).mappings().one()

    collected = float(c_row["collected"])
    scheduled = float(s_row["scheduled"])
    rate = round(collected / scheduled * 100, 2) if scheduled > 0 else 0.0

    return {
        "scheduled":      scheduled,
        "collected":      collected,
        "collectionRate": rate,
    }


@router.get("/overdue")
async def overdue_accounts(
    days_overdue: int  = Query(1,    ge=1, description="Minimum days past due"),
    branch_id:    Optional[int] = Query(None, description="Filter by office/branch ID"),
    limit:        int  = Query(100,  ge=1, le=500),
    offset:       int  = Query(0,    ge=0),
):
    """
    Loan accounts with installments overdue past the threshold.
    Sorted by days_overdue DESC then total_overdue DESC.
    """
    branch_filter = "AND l.client_id IN (SELECT id FROM m_client WHERE office_id = :branch_id)" \
                    if branch_id else ""

    sql = text(f"""
        SELECT
            l.id                                                                     AS loan_id,
            l.account_no,
            c.display_name                                                           AS client_name,
            c.mobile_no,
            l.currency_code                                                          AS currency,
            MIN(lrs.duedate)                                                         AS oldest_overdue_date,
            DATEDIFF(CURRENT_DATE, MIN(lrs.duedate))                                 AS days_overdue,
            SUM(
                COALESCE(lrs.principal_amount,       0) - COALESCE(lrs.principal_completed_derived,       0)
                                                       - COALESCE(lrs.principal_writtenoff_derived,       0)
              + COALESCE(lrs.interest_amount,        0) - COALESCE(lrs.interest_completed_derived,        0)
                                                       - COALESCE(lrs.interest_writtenoff_derived,        0)
                                                       - COALESCE(lrs.interest_waived_derived,            0)
              + COALESCE(lrs.fee_charges_amount,     0) - COALESCE(lrs.fee_charges_completed_derived,     0)
                                                       - COALESCE(lrs.fee_charges_waived_derived,         0)
                                                       - COALESCE(lrs.fee_charges_writtenoff_derived,     0)
              + COALESCE(lrs.penalty_charges_amount, 0) - COALESCE(lrs.penalty_charges_completed_derived, 0)
                                                       - COALESCE(lrs.penalty_charges_waived_derived,     0)
                                                       - COALESCE(lrs.penalty_charges_writtenoff_derived, 0)
            )                                                                        AS total_overdue
        FROM  m_loan l
        JOIN  m_client c             ON c.id = l.client_id
        JOIN  m_loan_repayment_schedule lrs ON lrs.loan_id = l.id
        WHERE l.loan_status_id        = :status
          AND lrs.duedate             < CURRENT_DATE
          AND lrs.completed_derived   = false
          AND lrs.obligations_met_on_date IS NULL
          {branch_filter}
        GROUP BY l.id, l.account_no, c.display_name, c.mobile_no, l.currency_code
        HAVING DATEDIFF(CURRENT_DATE, MIN(lrs.duedate)) >= :days_overdue
           AND SUM(
                COALESCE(lrs.principal_amount,       0) - COALESCE(lrs.principal_completed_derived,       0)
                                                       - COALESCE(lrs.principal_writtenoff_derived,       0)
              + COALESCE(lrs.interest_amount,        0) - COALESCE(lrs.interest_completed_derived,        0)
                                                       - COALESCE(lrs.interest_writtenoff_derived,        0)
                                                       - COALESCE(lrs.interest_waived_derived,            0)
              + COALESCE(lrs.fee_charges_amount,     0) - COALESCE(lrs.fee_charges_completed_derived,     0)
                                                       - COALESCE(lrs.fee_charges_waived_derived,         0)
                                                       - COALESCE(lrs.fee_charges_writtenoff_derived,     0)
              + COALESCE(lrs.penalty_charges_amount, 0) - COALESCE(lrs.penalty_charges_completed_derived, 0)
                                                       - COALESCE(lrs.penalty_charges_waived_derived,     0)
                                                       - COALESCE(lrs.penalty_charges_writtenoff_derived, 0)
               ) > 0
        ORDER BY days_overdue DESC, total_overdue DESC
        LIMIT :limit OFFSET :offset
    """)

    params: dict = {
        "status":      _ACTIVE,
        "days_overdue": days_overdue,
        "limit":       limit,
        "offset":      offset,
    }
    if branch_id:
        params["branch_id"] = branch_id

    async with get_session() as db:
        result = await db.execute(sql, params)
        rows = result.mappings().all()

    return [
        {
            "loanId":           r["loan_id"],
            "accountNo":        r["account_no"],
            "clientName":       r["client_name"],
            "mobileNo":         r["mobile_no"],
            "currency":         r["currency"],
            "oldestOverdueDate": r["oldest_overdue_date"].isoformat(),
            "daysOverdue":      int(r["days_overdue"]),
            "totalOverdue":     float(r["total_overdue"]),
        }
        for r in rows
    ]
