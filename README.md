# 🏢 Multi-Tenant HRMS Platform

A modern, full-featured **Human Resource Management System (HRMS)** built as a multi-tenant platform. The application provides organization management, attendance tracking with regularization, leave management, multi-level approvals, audit logs, and an interactive organization chart visualization.

---

## 🚀 Quick Start & Run Commands

From the root directory of the workspace, you can easily install and run the entire application:

```bash
# 1. Install dependencies for both Backend & Frontend
npm run install-all

# 2. Run both Backend & Frontend concurrently in Development mode
npm run dev
```

The system will start:
* **Frontend**: [http://localhost:5173](http://localhost:5173) (Vite Dev Server)
* **Backend API**: [http://localhost:5001](http://localhost:5001)

---

## 🛠️ Tech Stack & Architecture

The project is structured as a monorepo with separate `frontend` and `backend` services.

### Frontend
* **Core Framework**: React 19 + Vite
* **Styling**: Vanilla CSS with structured design tokens and theme palettes (`index.css` / `App.css`)
* **State & Auth**: Context API (`AuthContext.jsx`) and built-in hooks for session and API calling
* **Components**: Structured view folders, modal sheets, dashboards, calendars, and organizational charts

### Backend
* **Runtime & Framework**: Node.js & Express
* **Database**: Dual-Mode Database Manager (`backend/src/db/db.js`)
  * **MongoDB (Mongoose)**: Enabled when `MONGO_URI` env variable is set.
  * **Local JSON File Document Store**: Automagic offline fallback storing schemas in `.database/` folder during offline development.
* **Authentication**: JWT-based session with secure token signing and role-based permissions (`HR/Admin` vs `Employee`).
* **Integrations**: `nodemailer` (email logs/alerts), `multer` (document uploads), and `pdfkit` (reports generation).

---

## 🌟 Key Features

### 1. Multi-Tenancy & Security
* **Tenant Isolation**: Separate tenant organizations (e.g., Acme Corp, Beta Inc) share the database safely, separated by `tenantId`.
* **Tenant Registration**: Multi-tenant sign-up page where admins can register new organizations and domains.
* **Custom Password Policies**: Enforce min length, special characters, and numeric constraints per tenant.
* **MFA Controls**: Configure Multi-Factor Authentication toggles.

### 2. Employee Profile & Directory
* **Interactive Directory**: List and search colleagues by department, location, and name.
* **Granular Profile Sections**:
  * Personal Info (Name, Photo, DOB, Gender, etc.)
  * Official contact and emergency details
  * Employment details (date of joining, reporting manager, department, designation, shift)
  * Direct Bank details (PAN, Aadhaar, account number, IFSC)
  * Professional records (Education, Experience, Skills, Certifications)
* **Delegation Manager**: Out-of-office setup to delegate approvals to specific users within active date ranges.
* **Notification Preferences**: Manage system alert options individually.

### 3. Smart Attendance Tracking
* **Clock-in/Clock-out Punches**: Location tracking via Geolocation (latitude/longitude coordinates) and IP address logging.
* **Auto Calculations**: Real-time tracking of daily work hours and overtime.
* **Regularization Requests**: Request punch-in/out corrections with detailed comments, triggering approval requests to reporting managers.

### 4. Advanced Leave Management
* **Leave Configurations**: Custom allocations per tenant for Leave Types (Sick, Casual, Earned, Loss of Pay).
* **Entitlements & Balances**: Automated leave balances allocation, carry-forward limits, and consecutive-day checks.
* **Leave Requests**: Create requests with half-day options (Morning/Afternoon slots) and reason attachments.

### 5. Unified Approval Engine
* **Multi-level Chains**: Seamlessly handles multiple approval workflows.
* **Request Processing**: Managers can review pending Leave applications and Attendance regularizations directly from their inbox.
* **Delegation Integration**: Auto-forwards reviews if a manager is out-of-office and has active delegation.

### 6. Audit & Holidays Management
* **Comprehensive Audit Trail**: Automatically logs user, action, IP addresses, and detailed metadata for administrative tracking.
* **Company Holiday Calendars**: Configure national and regional holidays per location.

---

## 📂 Project Structure

```
├── backend/
│   ├── .database/            # Generated Local JSON database files (when MongoDB is not connected)
│   ├── src/
│   │   ├── db/
│   │   │   ├── db.js         # Unified database client (JSON vs MongoDB selector)
│   │   │   └── seed.js       # Database seeder utility
│   │   ├── middleware/       # JWT auth & request validations
│   │   ├── models/           # Data schemas (Tenant, Employee, Attendance, Leave, etc.)
│   │   ├── routes/           # API endpoints (Auth, Leave, Org, Holidays, Dashboard, etc.)
│   │   └── server.js         # Entry point for backend Express app
│   ├── tests/                # Jest/API test suites
│   ├── package.json
│   └── .env                  # Port, environment, JWT secret, and DB connection details
│
├── frontend/
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── assets/           # UI media assets
│   │   ├── components/       # Reusable layout and helper widgets
│   │   ├── context/          # React Context providers (Auth, Theme)
│   │   ├── pages/            # View pages (Login, Dashboard, Approvals, Profile, Directory, etc.)
│   │   ├── index.css         # Central CSS design system
│   │   ├── App.jsx           # Routing & layout orchestration
│   │   └── main.jsx          # React initialization entry point
│   ├── vite.config.js
│   └── package.json
│
├── package.json              # Monorepo scripts (concurrent dev and auto installation)
└── README.md                 # Project guide (this file)
```

---

## 🔑 Seeding & Default Test Accounts

On application startup, the backend automatically seeds initial mock data if the database is empty. You can use the following default credentials to test the platform:

### 🏢 Tenant: Acme Corp (`acme.com`)

| User Role | Email | Password | Details |
|---|---|---|---|
| **HR / Admin** | `alice@acme.com` | `Password123` | Can view reports, audit logs, manage org settings, holidays, and approve requests. |
| **Employee** | `bob@acme.com` | `Password123` | Standard employee, reports to Alice. Can request leaves, check-in attendance, view directory, and submit regularizations. |

### 🏢 Tenant: Beta Inc (`beta.com`)

| User Role | Email | Password | Details |
|---|---|---|---|
| **HR / Admin** | `charlie@beta.com` | `Password123` | HR Director for Beta Inc organization. |

---

## 🧪 Testing

The backend includes api testing code to verify routing, data controllers, and custom policies.

To run API integration and feature tests:

```bash
cd backend
npm run test
```

---

## 📝 Environment Variables (`backend/.env`)

Ensure you have a `.env` file set up inside the `backend` directory. Example:

```env
PORT=5001
NODE_ENV=development
JWT_SECRET=hrms_super_secret_key_123
JWT_REFRESH_SECRET=hrms_refresh_secret

# Optional: Add MongoDB connection string. 
# If empty, the backend defaults to the Local JSON Database fallback (.database/)
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/dbname
```
