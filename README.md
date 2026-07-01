# AI Expense Tracker (MEAN Stack)

A complete production-ready AI Expense Tracker built using the MEAN stack (MongoDB, Express.js, Angular, Node.js) with Google Gemini AI integration, Chart.js for data visualization, and pdfmake for PDF reports.

## Features

- **Authentication**: Secure registration, login, and profile updates powered by JWT + bcrypt.
- **Dashboard**: High-level financial overview containing balance details, savings rate, and recent transactions.
- **Income & Expense CRUD**: Log incomes and expenses with search, category filtering, sorting, and pagination.
- **Budget Tracking**: Set monthly spending limits and view usage meters (green, yellow, red progress bar status).
- **AI Financial Advisor**: One-click professional financial advisor feedback based on actual category breakdowns and net values using the **Google Gemini API**.
- **Notification Engine**: Trigger automated alerts for budget exceedance or unusually high single-transaction volumes.
- **Reports & PDF Statements**: Select a monthly or yearly period, view tables, and instantly download a styled financial statement PDF.
- **Admin Panel**: Administrator dashboard with global statistics, total counts, and user list deletion operations.

---

## Tech Stack

- **Frontend**: Angular 22 (Standalone Components, Reactive Forms, Services, Routing Guards, functional JWT Http Interceptors)
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (Mongoose models)
- **Security**: JWT + bcryptjs + Helmet + CORS
- **Charts**: Chart.js (Native integrations)
- **AI Service**: Google Gemini API SDK (`@google/generative-ai`)
- **PDF Exporter**: pdfmake (Binary streams)
- **Styling**: Bootstrap 5 + FontAwesome Icons (CDN integrated)
- **Deployment**: Docker + Docker Compose

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### 1. Backend Server Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up environment configuration:
   Create a `.env` file or update the existing one:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/expense-tracker
   JWT_SECRET=supersecretjwtkeyforai-expensetracker123!
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
   NODE_ENV=development
   ```
3. Install dependencies and start server:
   ```bash
   npm install
   npm start
   ```
   The server will start on `http://localhost:5000`.

### 2. Angular Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the Angular dev server:
   ```bash
   npm start
   ```
   The application will start on `http://localhost:4200`.

---

## Run Containerized with Docker

You can launch MongoDB, the backend API, and the frontend server together using Docker Compose.

1. Ensure Docker is running.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Access endpoints:
   - **Frontend UI**: `http://localhost:8080`
   - **Backend API**: `http://localhost:5000`
   - **MongoDB Database**: `mongodb://localhost:27017`

---

## API Testing with Postman

A preconfigured Postman Collection is available in the project under [docs/Expense_Tracker_Postman.json](file:///Users/ramprasadreddy/Desktop/final%20mean/docs/Expense_Tracker_Postman.json). Load it into Postman to test Auth, Incomes, Expenses, Budgets, Reports, AI suggestions, and Admin endpoints.
