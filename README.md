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
The main script handles the entire cycle. It checks `state.json` to decide whether to Claim or Stake/Vote/Delegate.
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

---

## ⚙️ How it works

### The State Cycle
The script maintains a `state.json` file to track its last action and ensure a clean rotation:
- **Day A**: Claims all pending voting rewards.
- **Day B**: Stakes, Votes for your SR, and Delegates all energy power.
- **Day C**: Repeat Day A.

### Recent Architectural Improvements
- **Modular Design**: Logic is separated into `lib/` (core) and `scripts/` (manual tests).
- **Professional Logging**: Every action is timestamped in ISO format for easy log review.
- **Power Precision**: The script now fetches your real-time "Total Tron Power" directly from the network, ensuring every single TRX is used in your vote.
- **Fail-Safe Validation**: The script validates your environment on startup and halts if critical keys are missing.

---

## 🗓️ Scheduling (Cron)
To run this automatically at midnight every day on a Linux server:

1. Open crontab: `crontab -e`
2. Add this line:
   ```bash
   0 0 * * * /usr/bin/node /path/to/your/folder/index.js >> /path/to/your/folder/cron.log 2>&1
   ```

## ⚠️ Security
- **Never** commit your `.env` file to version control.
- Ensure your server is secure, as `.env` contains your wallet's private key.
