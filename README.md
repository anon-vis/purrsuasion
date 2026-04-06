# Purrsuasion

This anonymized repo contains code for the data-communication game discussed in the VIS 2026 submission: _Investigating Ethical Data Communication with Purrsuasion: An Educational Game about Negotiated Data Disclosure_.

[Teaser figure](./public/teaser.png)

# Setup Guide

## Table of Contents

1. [Prerequisites and Installation](#1-prerequisites-and-installation)
2. [Creating a Class and Enrolling Students](#2-creating-a-class-and-enrolling-students)
3. [Reviewing Students Before Starting](#3-reviewing-students-before-starting)
4. [Configuring Puzzles](#4-configuring-puzzles)
5. [Starting the Class](#5-starting-the-class)
6. [Monitoring a Session in Progress](#6-monitoring-a-session-in-progress)
7. [Using the Rubric Interface](#7-using-the-rubric-interface)
8. [Exporting Gameplay Data](#8-exporting-gameplay-data)
9. [Known Gotchas](#9-known-gotchas)
10. [Deployment](#10-deployment)

---

## 1. Prerequisites and Installation

### Requirements

- **Node.js** v20 or later
- Package manager of choice (`npm`, `pnpm` etc.)
  - We use `pnpm` in this guide
- SQLite (database)
  - macOS: SQLite is generally preinstalled, but if it isn't for some reason, then we recommend installing it via Homebrew by running `brew install sqlite`.
  - Windows: Go to the [SQLite download page](https://www.sqlite.org/download.html) and download the **Precompiled Binaries for Windows** — the file named `sqlite-tools-win-x64-*.zip`.

### Install dependencies

Once you clone this repo, navigate to the project root and run:

```bash
pnpm install
```

### Set up environment variables

Create a `.env` file in the project root:

```env
JWT_SECRET=<a long random hex string>
DATABASE_URL=./src/db/purrsuasion.db
```

To generate a suitable `JWT_SECRET` (which is used for basic authentication system):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Initialize the database

Run this command to creates all tables, seed, the default prompts and admin account:

```bash
pnpm setup
```

> Note: if you ever need to wipe everything and start fresh: `pnpm reset`. This destroys all data — never run it during an active session.

### Start the server

```bash
pnpm dev
```

The app runs at `http://localhost:4321`.

### Default admin account

| Username | Password |
| -------- | -------- |
| `admin`  | `admin`  |

---

## 2. Creating a Class and Enrolling Students

Navigate to **Admin → Classes** (`/admin/classes/`) and click **add class**.

Fill in:

- **Name** — e.g., `CS 12345`
- **Description** — e.g., `Fall 2026`
- **Student data** — a CSV file

### CSV format

```
Username,Password
alice,hunter2
bob,correct-horse
carol,staple
```

- Each row creates one student account. Usernames must be unique across the entire system.
- Passwords are stored as secure hashes in the database, but aren't used by default. The default configuration lets user log in simply by using their username.
- All imported students are automatically marked **active** and **consented**. Adjust before starting if needed (see section 3).

Click **confirm**. The class is created in the `inactive` state. No game has started yet.

---

## 3. Reviewing Students Before Starting

Go to **Admin → Classes → [your class]** (`/admin/classes/<classId>`).

You will see a table of enrolled students with two toggleable flags:

| Flag          | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| **Active**    | Student is participating. Deactivate absent students. |
| **Consented** | Student's data will be included in the JSON export.   |

**Before clicking "Start class":**

- Deactivate any absent students.
- If using data for research, verify consent status matches what students agreed to.
- Ensure the active student count is divisible by 3 (see [Known Gotchas](#10-known-gotchas)).

---

## 4. Configuring Puzzles

The game ships with three show-puzzles. All puzzle content lives in a single file:

```
src/config/puzzles.json
```

Each puzzle entry contains:

| Field             | What it is                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `name`            | The puzzle's category name — used as its identifier throughout the system                 |
| `prompts`         | Receiver and sender role instructions shown to students, plus a condensed sidebar summary |
| `signals`         | Rubric heuristics shown to the instructor during review                                   |
| `defaultNotebook` | Python cells pre-loaded into each sender's notebook at class start                        |

### The three built-in puzzles

| Puzzle name                        | Scenario                                                 | Dataset                    |
| ---------------------------------- | -------------------------------------------------------- | -------------------------- |
| **Outliers and Individual Points** | Warehouse logistics — identify atypical warehouses       | `oaip.csv`                 |
| **Peaks and Gaps**                 | Air quality — identify pollution peaks and data gaps     | `pag.csv`                  |
| **Hot Spots and MAUP**             | Retail saturation — identify geographic density patterns | `hsam.csv` + GeoJSON files |

Dataset files are served as static files from `public/data/` (e.g., `/oaip.csv`).

### Modifying prompt text

Open `src/config/puzzles.json` and edit the `instructions` or `condensed_instructions` fields under the relevant puzzle's `prompts` array. Then re-seed so the database picks up the changes:

```bash
pnpm seed:run
```

> `pnpm seed:run` deletes all rows from `users` and `prompts` before re-inserting. Only run this before a class starts.

### Modifying default notebook cells

Edit the `defaultNotebook` array inside the relevant puzzle entry in `src/config/puzzles.json`. Each entry has a `cell_type` (`"code"` or `"raw"`) and a `source` array of strings (one string per line). Changes only affect notebooks created after the next class start — existing notebooks are not updated.

---

## 5. Starting the Class

On the class detail page, click **start class**. A confirmation dialog reminds you to deactivate absent students first. Click **confirm**.

### What happens automatically

1. **Group formation** — Active students are divided into groups of 3. The algorithm prioritizes keeping consented students together (maximizing groups whose data can be exported).
2. **Round creation** — Each group gets one round per group member (3 rounds for a group of 3). Only the first round is initially active.
3. **Role and puzzle assignment** — For each round, one student is assigned as receiver (rotating each round) and the others as senders. Each round uses a different puzzle category, randomly selected from those available.
4. **Notebook initialization** — Each sender gets a private Python notebook pre-loaded with the starter cells for their puzzle.

After starting, the class detail page switches to an in-progress view showing each group, their current round, and each student's role.

---

## 6. Monitoring a Session in Progress

Go to **Admin → Classes → [your class]** (`/admin/classes/<classId>`).

The page shows a table per group with:

- **Group number**
- **Current round** number
- Each student's **username**, **role** (receiver or sender), and **consent status**

Reload the page to see updated state. Live refresh is in development will be included in future releases.

---

## 7. Using the Rubric Interface

Navigate to **Admin → Classes → [your class]** and click **go to rubric**, or go directly to `/admin/rubric/<classId>`.

The interface has four panels left to right:

### Panel 1 — Puzzle selector and sender list

1. Select a puzzle from the dropdown.
2. A list of senders who completed that puzzle appears below.
3. Click a sender's name to load their visualizations.

### Panel 2 — Visualizations

- **Sent** — visualizations the sender submitted to the receiver.
- **Intermediate** — all visualizations generated during the session, including ones not sent. Click any visualization to load its notebook snapshot.

### Panel 3 — Notebook Snapshot

Shows the full notebook state at the moment a visualization was produced — all cells in order, with the executed cell highlighted.

### Panel 4 — Heuristics

Evaluation criteria from `puzzles.json`, filtered to the mark types detected in the selected visualization. Each heuristic can be scored:

- **satisfied** (green)
- **risked** (yellow)
- **broken** (red)

---

## 8. Exporting Gameplay Data

From the rubric page, click **export gameplay data** in the bottom-left sidebar.

A file named `gameplay-export-class-<classId>.json` is downloaded.

Only students marked **consented** have their data included. Usernames in the export are anonymized as `student_<id>`.

Export structure:

```json
{
  "<groupId>": {
    "student_usernames": ["student_1", "student_2", "student_3"],
    "rounds": {
      "1": {
        "round_number": 1,
        "started_at": "ISO timestamp",
        "completed_at": "ISO timestamp",
        "prompt_category": "Hot Spots and MAUP",
        "receiver_username": "student_1",
        "winner_username": "student_2",
        "justification": "...",
        "message_threads": {
          "student_2": [
            {
              "from_username": "student_2",
              "to_username": "student_1",
              "subject": "...",
              "body": "...",
              "has_vis": 1,
              "timestamp": "ISO timestamp"
            }
          ]
        }
      }
    }
  }
}
```
The full gameplay data, beyond what is afforded by the export, can be explored directly by writing queries against the SQLite database file.

---

## 9. Known Gotchas

### Student count must be divisible by 3

Groups are always size 3. If your active student count is not divisible by 3, one or more groups will be smaller and play fewer rounds (one round per group member).

To pad the count, you may want to create a TA account in the CSV, mark it **not consented**, and activate or deactivate it to bring the total to a multiple of 3.

### Consent defaults to true for all CSV imports

Every student imported via CSV starts as consented. Toggle consent off on the class detail page **before starting** for any student who did not agree to data collection. This only matters if you're planning on using student data for research purposes. Be sure to follow the guidelines set by your institution's IRB.

### Puzzle assignment is random

Which puzzle each group plays in each round is randomly assigned at class start. Currently, you cannot pre-assign specific puzzles to specific groups.

### Re-seeding wipes all users and prompts

`pnpm seed:run` and `pnpm reset` delete all rows from `users` and `prompts`. Never run these during an active class session.

### Sessions expire after 3 hours

Student sessions time out after 3 hours. Students logged in longer than that will be redirected to the login page.

## 10. Deployment

Purrsuasion is designed to be self-hosted on a single machine for the duration of a class session. While we did not use any external providers for our instance, future documentation will contain guidance on how to host on various cloud provider platforms.

### Database

The app uses **SQLite** via `better-sqlite3`. The database is a single file at the path specified by `DATABASE_URL` in your `.env`, that will be created once the app runs.

### Running in production

Build the app before deploying:

```bash
pnpm build
pnpm start
```

`pnpm dev` runs a development server with hot reloading and is not suitable for classroom use. `pnpm start` runs the compiled output, which is faster and more stable.

Set `NODE_ENV=production` in your `.env` to disable development error overlays:

```env
NODE_ENV=production
JWT_SECRET=<your secret>
DATABASE_URL=./src/db/purrsuasion.db
```

### Running on a local network

The most straightforward deployment for a single classroom session is to run the app on a laptop or desktop connected to the same network as your students, and have students connect by IP address.

Once you run `pnpm start` the terminal output should print the network URL where the app can be accessed. It will be in the form: `http://<your_ip>:4321`.

### Running on a server

WIP

---

# Configuration Reference

This document describes everything an instructor might want to change when adapting the game for a new class, where each value lives, and what changing it affects.

Values split into two categories:

- **Already configurable** — live in `src/config/` and can be edited without touching application logic.
- **Requires a code edit** — still hardcoded in source files outside `src/config/`.

---

## Already Configurable

### 1. Puzzle Definitions (`src/config/puzzles.json`)

All puzzle content lives in one file. Each puzzle entry has four fields:

| Field             | What it controls                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `name`            | The puzzle's identifier — shown in the rubric dropdown, used to match prompts to notebooks        |
| `prompts`         | Role instructions shown to students (`instructions`, `condensed_instructions`, `is_for_receiver`) |
| `signals`         | Rubric heuristics shown per mark type during instructor review                                    |
| `defaultNotebook` | Python cells pre-loaded into each sender's notebook at class start                                |

**To change prompt text or rubric heuristics:** Edit the relevant fields, then run `pnpm seed:run` to push prompt changes into the database. Heuristic changes (`signals`) take effect on the next page load — no re-seed needed.

**To change default notebook cells:** Edit the `defaultNotebook` array. Changes only affect notebooks created after the next class start.

> `pnpm seed:run` deletes all rows from `users` and `prompts` before re-inserting. Only run this before a class starts.

---

### 2. Game Rules (`src/config/game.config.ts`)

Three game rule constants are defined here:

| Constant                | Default | What it controls                                                   |
| ----------------------- | ------- | ------------------------------------------------------------------ |
| `MAX_THREAD_SIZE`       | `4`     | Maximum messages (in both directions) per thread per round         |
| `GROUP_SIZE`            | `3`     | Students per group; also determines the number of rounds per group |
| `MIN_STUDENTS_TO_START` | `2`     | Minimum active students required to start a class                  |

Edit the constant and restart the server. No re-seed required.

**Note on `GROUP_SIZE`:** Changing this also changes how many rounds each group plays (one per group member) and how many puzzles they cycle through. If you set `GROUP_SIZE = 2`, groups will only play 2 puzzles — ensure at least 2 puzzle entries exist in `puzzles.json`.

---

### 3. Session Duration (`src/config/game.config.ts`)

```typescript
export const JWT_EXPIRATION = "3h";
```

Uses the `jose` library's duration string format: `"1h"`, `"30m"`, `"2d"`, etc. Edit and restart the server. Applies to all users (students and admin).

---

### 4. SSE Heartbeat (`src/config/game.config.ts`)

```typescript
export const HEARTBEAT_INTERVAL = 30000; // ms between keepalive pings
export const HEARTBEAT_TIMEOUT = 120000; // ms of no heartbeat before cleanup
```

These control real-time event reliability. A shorter interval increases server load but detects dead connections faster. Unlikely to need tuning for normal classroom use.

---

## Requires a Code Edit

### 5. Dataset Files

**Where they live:** `public/data/` — served as static files (e.g., `/oaip.csv`, `/pag.csv`, `/hsam.csv`, plus GeoJSON files).

**To replace a dataset:** Swap the file in `public/data/`. If you rename a file, also update the `defaultNotebook` source lines in `src/config/puzzles.json` that reference that filename, and update the `relevant_fields` in the puzzle's `signals` if column names changed.

---

### 6. Default Admin Credentials

**Where it lives:** `src/db/seeds/02_admin_users.mjs`

```javascript
{ username: "admin", password_hash: "admin", ... }
```

Re-seeding (`pnpm seed:run`) resets the admin password to whatever is in this file. While there is basic password security built into the platform, we do not enable this by default since we expect the game to be run in the context of one classroom session.

---
