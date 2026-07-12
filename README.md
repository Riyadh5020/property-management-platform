# Property Management Platform

A centralized platform for managing buildings, units, tenants, leases, billing, maintenance, security, parking, staff, utilities, owners, and property-level reporting.

> **Project status:** Requirements and engineering planning
>
> **Repository type:** Product specification and implementation starter

## Product Vision

Build a reliable property operations platform that gives management teams a single source of truth for property inventory, occupancy, tenant relationships, contracts, collections, maintenance, utilities, staff, security, owners, and business performance.

## Core Objectives

- Manage multiple buildings from one system.
- Maintain accurate floor, unit, tenant, owner, and occupancy records.
- Automate recurring rent and utility billing.
- Improve rent collection visibility and payment tracking.
- Standardize lease, move-in, move-out, and renewal workflows.
- Track maintenance requests and preventive maintenance.
- Support building security, visitor, delivery, parking, and incident operations.
- Provide separate, role-based experiences for administrators, staff, tenants, and owners.
- Produce actionable building-level and portfolio-level reports.

## Product Modules

| Module | Main capabilities |
|---|---|
| Building & Unit Management | Buildings, floors, units, amenities, occupancy and status tracking |
| Tenant Management | Tenant profiles, documents, co-tenants, move-in and move-out |
| Lease & Contract Management | Agreements, signatures, renewals, escalation, deposits and notices |
| Rent & Billing | Recurring invoices, utilities, penalties, partial payments and receipts |
| Maintenance & Facilities | Service requests, work tracking, preventive and common-area maintenance |
| Visitor & Security | Visitor logs, entry/exit, deliveries, guard rosters and incidents |
| Parking | Slot assignment, visitor parking and parking charges |
| Staff Management | Building staff, schedules, attendance and HRM integration readiness |
| Utility Management | Meter readings, bill calculation, shared costs and vendors |
| Owner/Investor Portal | Ownership, dues, distributions, statements and reports |
| Reports & Analytics | Occupancy, collections, vacancy, maintenance cost and revenue reporting |

Detailed requirements are available in [`docs/product/product-requirements.md`](docs/product/product-requirements.md).

## Recommended Delivery Phases

### Phase 1 — Property Operations MVP

- Organization, user and role setup
- Building, floor, unit and amenity management
- Tenant profiles and document records
- Lease lifecycle and deposit tracking
- Automatic monthly rent invoices
- Payment, partial payment and receipt tracking
- Basic maintenance requests
- Occupancy, vacancy and rent collection reports

### Phase 2 — Operational Expansion

- Utility meters, readings and bill calculation
- Late fees, rent escalation and renewal automation
- Preventive maintenance and vendor workflows
- Parking management
- Visitor, delivery and incident logs
- Staff roster and attendance
- Tenant portal

### Phase 3 — Financial & Ecosystem Features

- Digital signing provider integration
- Owner/investor portal and rent distribution
- HRM integration
- Payment gateway and accounting integration
- Advanced analytics, notifications and audit reporting

## Repository Structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── docs/
│   ├── architecture/
│   │   ├── data-model.md
│   │   ├── system-design.md
│   │   └── adr-template.md
│   ├── development/
│   │   ├── api-guidelines.md
│   │   ├── definition-of-done.md
│   │   └── git-workflow.md
│   └── product/
│       ├── product-requirements.md
│       ├── roles-and-permissions.md
│       ├── roadmap.md
│       └── user-stories.md
├── CONTRIBUTING.md
├── PROJECT_CONTEXT.md
├── SECURITY.md
└── README.md
```

## Engineering Principles

- **Multi-building by design:** every operational record must be traceable to an organization and building.
- **Role-based access:** users only access approved buildings, modules and actions.
- **Financial accuracy:** invoices, payments, balances, deposits and owner distributions must use immutable transaction records where practical.
- **Auditability:** critical create, update, approve, cancel and delete actions must be logged.
- **Configurable workflows:** charges, penalties, notice periods and approval steps should not be hard-coded.
- **Secure document handling:** tenant, owner and agreement documents require strict access control.
- **API-first integration readiness:** support future HRM, accounting, digital signature, SMS, email and payment integrations.

## Getting Started

This repository currently contains the agreed product scope and engineering foundation. After the technology stack is approved:

1. Record the architecture decision in `docs/architecture/`.
2. Add application folders such as `apps/`, `services/`, or `packages/`.
3. Add environment configuration examples without real credentials.
4. Configure CI for linting, tests, security checks and builds.
5. Convert roadmap items and user stories into GitHub issues or project-board tickets.

## Suggested Repository Name

`property-management-platform`

Other suitable options:

- `property-operations-suite`
- `building-management-system`
- `real-estate-operations-platform`

## Documentation Index

- [Project context](PROJECT_CONTEXT.md)
- [Product requirements](docs/product/product-requirements.md)
- [User stories and acceptance criteria](docs/product/user-stories.md)
- [Roles and permissions](docs/product/roles-and-permissions.md)
- [Product roadmap](docs/product/roadmap.md)
- [Proposed system design](docs/architecture/system-design.md)
- [Conceptual data model](docs/architecture/data-model.md)
- [API guidelines](docs/development/api-guidelines.md)
- [Git workflow](docs/development/git-workflow.md)
- [Repository setup](docs/development/repository-setup.md)
- [Definition of done](docs/development/definition-of-done.md)

## License

Proprietary and confidential unless the project owner approves another license in writing.
