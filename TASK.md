EPIC: Introduce Budget Categories (Needs / Wants / Savings) with Unallocated Flow

==================================================
EPIC 1 — Database & Domain Model
==================================================

TASK 1.1 — Update Buckets Schema
--------------------------------
Modify the `buckets` table to support budget categories and system buckets.

Requirements:
- Add column `category`:
  - Allowed values: needs | wants | savings | NULL
- Add column `is_system` (boolean, default false)
- Enforce rules:
  - is_system = true  -> category MUST be NULL
  - is_system = false -> category MUST NOT be NULL

Acceptance Criteria:
- Migration runs without data loss
- Existing buckets are backfilled with:
  - category = 'needs'
  - is_system = false


TASK 1.2 — Create Unallocated Bucket
------------------------------------
Ensure every group has exactly one system bucket named "Unallocated".

Rules:
- Automatically created when:
  - User registration completes
  - Family/group is created
- is_system = true
- category = NULL
- Cannot be deleted or edited

Acceptance Criteria:
- Every group always has exactly one Unallocated bucket
- Attempts to delete or change category are rejected


==================================================
EPIC 2 — API Changes
==================================================

TASK 2.1 — Update Bucket CRUD API
--------------------------------
Update bucket CRUD endpoints to support category-based buckets.

Rules:
- Category is required for non-system buckets
- System buckets are read-only
- (Optional) Prevent category change if bucket already has transactions

Acceptance Criteria:
- Buckets can be created under needs / wants / savings
- Unallocated bucket is excluded from normal CRUD


TASK 2.2 — Group Buckets by Category in API Response
----------------------------------------------------
Return buckets grouped by category for frontend simplicity.

Response format:
{
  system: {
    unallocated: { id, total }
  },
  needs: [],
  wants: [],
  savings: []
}

Acceptance Criteria:
- API always returns all categories even if empty
- Unallocated bucket is always present


TASK 2.3 — Big 3 Summary API
----------------------------
Add an API endpoint to summarize Needs / Wants / Savings.

Logic:
- Needs / Wants: sum of transaction amounts
- Savings: sum of inflows
- Exclude unallocated
- Calculate percentage vs monthly limit or target

Acceptance Criteria:
- Accurate aggregation
- Works even if some categories have no buckets


TASK 2.4 — Transaction Reassignment API
---------------------------------------
Allow transactions to be moved from Unallocated to categorized buckets.

Endpoint:
POST /transactions/reassign

Rules:
- Supports bulk transaction reassignment
- Permission-checked (editor or owner)

Acceptance Criteria:
- Transactions can be reassigned successfully
- Dashboard updates immediately


==================================================
EPIC 3 — Bot Changes
==================================================

TASK 3.1 — Auto-Create Unallocated Bucket
-----------------------------------------
When registration completes, automatically create the Unallocated bucket.

Acceptance Criteria:
- First transaction always goes to Unallocated
- No user input required


TASK 3.2 — Default Transaction Routing
--------------------------------------
Recommend a bucket for user, if no bucket exist then user Unallocated as default

Acceptance Criteria:
- Logging expenses has zero friction
- Bot confirms which bucket was used


TASK 3.3 — Progressive Budget Education
---------------------------------------
Educate users about budgeting without blocking tracking.

Triggers:
- After 5 logged transactions
- When Unallocated total exceeds a threshold

Bot Message Example:
"You’ve logged several expenses 👍
Want to organize them into Needs, Wants, and Savings?"

Buttons:
[Set up budget] [Later]

Acceptance Criteria:
- Non-blocking
- Can be dismissed


==================================================
EPIC 4 — Mini App (Web)
==================================================

TASK 4.1 — Dashboard Big 3 Redesign
----------------------------------
Update dashboard to highlight Needs, Wants, and Savings as primary KPIs.

UI:
- 3 summary cards
- Progress bars
- Color-coded

Acceptance Criteria:
- Big 3 visible without scrolling
- Unallocated shown as warning, not a KPI


TASK 4.2 — Budget Manager Categorized UI
----------------------------------------
Redesign Budget Manager to group buckets by category.

Layout:
Needs
  - Buckets
Wants
  - Buckets
Savings
  - Buckets

Acceptance Criteria:
- CRUD works per category
- System buckets are locked or hidden


TASK 4.3 — Allocation Flow UI
-----------------------------
Allow users to allocate Unallocated transactions.

Features:
- List unallocated transactions
- Multi-select
- Assign to bucket

Acceptance Criteria:
- Bulk allocation works
- Dashboard updates instantly


==================================================
EPIC 5 — Migration & Backward Compatibility
==================================================

TASK 5.1 — Data Migration Script
--------------------------------
Safely migrate existing users and groups.

Rules:
- Existing buckets -> category = needs
- Create Unallocated bucket if missing

Acceptance Criteria:
- No broken dashboards
- No NULL category issues


==================================================
EPIC 6 — Intelligence & Coaching (Recommended)
==================================================

TASK 6.1 — Budget Health Score
------------------------------
Add a monthly budget health score based on 50/30/20 rule.

Acceptance Criteria:
- Score is computed monthly
- Displayed on dashboard


TASK 6.2 — Smart Spending Warnings
----------------------------------
Notify users when spending patterns are unhealthy.

Examples:
- Needs > 70%
- Wants > 30%
- Savings < 10%
- Large Unallocated balance

Acceptance Criteria:
- Warnings are informative, not blocking


==================================================
PRODUCT PRINCIPLE
==================================================

Tracking is mandatory.
Budgeting is optional — but encouraged.
