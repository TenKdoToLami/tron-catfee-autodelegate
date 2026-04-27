# TRON Catfee Auto-Delegate

A professional, modular Node.js automation for TRON staking, voting, and delegation. This script alternates daily between claiming rewards and reinvesting them (staking/voting/delegating) to maximize your yield on [Catfee.io](https://catfee.io).

## 🚀 Getting Started

### 1. Installation
Ensure you have [Node.js](https://nodejs.org/) installed, then:
```bash
npm install
```

### 2. Configuration
Copy `.env.example` to `.env` and fill in your details:
```bash
PRIVATE_KEY=your_private_key_here
VOTE_SR_ADDRESS=TTcYhypP8m4phDhN6oRexz2174zAerjEWP  # Default: Cryptoguyinza
TRX_FEE_RESERVE=0                                  # TRX to keep for gas (e.g. 20)
FULL_HOST=https://api.trongrid.io
```

---

## 🛠️ Usage

### 🔄 Automatic Routine (The Orchestrator)
The main script handles the entire cycle. It checks the SQL database (`data.db`) to decide whether to Claim or Stake/Vote/Delegate.
```bash
npm start
```

### 🧪 Modular Actions (Run One-by-One)
If you want to perform a specific action manually without affecting the automation state, use these commands:

| Action | Command | Description |
| :--- | :--- | :--- |
| **Claim** | `npm run claim` | Withdraws all pending staking rewards to your balance. |
| **Stake** | `npm run stake` | Stakes available TRX for Energy (respecting your reserve). |
| **Vote** | `npm run vote` | Casts **all** your voting power for your chosen SR. |
| **Delegate** | `npm run delegate` | Finds the best Catfee.io project and delegates energy. |
| **History** | `npm run history` | Records a manual balance snapshot to the SQL database. |

---

## ⚙️ How it works

### The State Cycle
The script maintains its state in a local SQLite database (`data.db`) to track its last action and ensure a clean rotation:
- **Day A**: Claims all pending voting rewards.
- **Day B**: Stakes, Votes for your SR, and Delegates all energy power.
- **Day C**: Repeat Day A.

### Recent Architectural Improvements
- **Multi-Node Reliability**: Support for primary (TronGrid) and secondary (TronStack) nodes with automatic fallback if one is rate-limited.
- **Gentle Execution**: Sequential API calls with 10-second delays between requests to avoid "Too Many Requests" (429) errors on public nodes.
- **Network Sync Logic**: Added a 5-minute wait period between voting and delegation to ensure the blockchain fully reflects new staking power.
- **SQL Persistence**: Uses SQLite (`data.db`) for robust state management and history tracking.
- **Stake 2.0 Optimization**: Specifically designed for TRON Stake 2.0 with automatic detection of legacy Stake 1.0 balances.

---

## 🗓️ Scheduling (Cron)
To run this automatically at midnight every day on a Linux server:

1. Make the script executable: `chmod +x setup-cron.sh`
2. Run the setup: `./setup-cron.sh`

---

## 🛡️ Best Practices
- **API Key**: While the script handles rate limits, adding a `TRONGRID_API_KEY` to your `.env` is recommended for maximum reliability.
- **Node Fallback**: The script defaults to `https://api.tronstack.io` as a secondary host if TronGrid is busy.

---

## ⚠️ Security
- **Never** commit your `.env` file to version control.
- Ensure your server is secure, as `.env` contains your wallet's private key.
