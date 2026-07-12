# Project Context

## Problem Statement

Property operations are often managed through disconnected spreadsheets, paper agreements, chat messages, manual receipts, and separate records maintained by different building staff. This creates inconsistent data, missed renewals, unclear balances, delayed maintenance, weak audit trails, and limited reporting.

## Proposed Solution

A role-based property management platform that centralizes the complete operational lifecycle of multiple buildings and units—from setup and occupancy to leases, rent collection, maintenance, utilities, security, parking, staff, owner settlements, and analytics.

## Primary Users

- Property company administrators
- Building and property managers
- Accounts and finance teams
- Facility and maintenance teams
- Security guards and supervisors
- Building staff
- Tenants and co-tenants
- Unit owners and investors

## Operating Model

The system should support the following hierarchy:

```text
Organization / Property Company
└── Building
    ├── Floors
    │   └── Units
    ├── Amenities
    ├── Parking Slots
    ├── Staff
    ├── Visitors and Incidents
    └── Common Utilities and Maintenance
```

A unit may have one or more owners and one active occupancy arrangement at a time. An occupancy arrangement may include multiple tenants or co-tenants. Historical ownership, tenancy, lease, billing and maintenance data must remain available after changes.

## Key Business Rules

1. A unit cannot have overlapping active leases unless explicitly configured for shared occupancy.
2. Unit status should normally be derived from active lease, reservation and maintenance records, with authorized manual override.
3. Invoice balances must equal charges minus payments, credits and approved adjustments.
4. Partial payments must be supported without marking the invoice fully paid.
5. Deposits must be tracked separately from rent income.
6. Lease escalation rules must create future rent changes without rewriting historical invoices.
7. Move-out completion should require settlement, meter readings, deposit decision, document handover and unit status update.
8. Sensitive documents must be restricted by role and building access.
9. Financial corrections should use reversals, credit notes or adjustments rather than silent deletion.
10. Critical actions must create audit-log records.

## Decisions Still Required

- Web-only or web plus mobile applications
- Preferred frontend, backend and database stack
- Single organization deployment or multi-organization SaaS
- Countries, currencies, taxes and localization requirements
- Payment gateway and accounting integrations
- SMS, email and push-notification providers
- Digital signature provider and legal requirements
- HRM integration target
- Document storage provider
- Hosting, backup and disaster-recovery requirements
- Approval workflows and finance authorization limits
