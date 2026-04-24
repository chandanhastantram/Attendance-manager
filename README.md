# Vorn — Attendance Manager 🎓

Vorn is a privacy-first, fully-featured Progressive Web App (PWA) designed to help students track their college attendance effortlessly. Built with modern web technologies, Vorn runs completely offline, storing all your data securely on your own device.

---

## 🌟 Key Features

*   **Smart Analytics & Projections**: Instantly see how many classes you can afford to skip, or how many you urgently need to attend to maintain your target criteria (e.g., 75%).
*   **Semester Forecast**: Set your semester start and end dates to unlock a comprehensive forecast of your attendance trajectory for the rest of the term.
*   **On Duty (OD) Support**: Dedicated tracking for official college duties (seminars, sports, events) which count positively towards your attendance percentage.
*   **AI Timetable Import**: Upload a photo or screenshot of your printed timetable. Vorn uses on-device OCR to automatically extract your subjects, days, and times!
*   **Weekly Grid View**: A beautiful, intuitive grid layout of your entire weekly schedule.
*   **One-Tap Bulk Marking**: Mark an entire day's worth of classes as Present, Absent, On Duty, or Cancelled with a single tap from the Home screen.
*   **Privacy First (Offline-Only)**: No servers, no accounts, no tracking. Your data never leaves your device thanks to IndexedDB storage.
*   **Customizable Aesthetics**: Warm, carefully curated color palettes with built-in Light, Dark, and System theme support.

---

## 📸 Screenshots

*(Replace these placeholders with actual screenshots of your app by adding images to a `docs/` folder!)*

| Home Dashboard | Subjects & Analytics |
|:---:|:---:|
| ![Home Dashboard](./docs/home.png) | ![Subjects Analytics](./docs/subjects.png) |
| *View your daily classes and bulk mark attendance.* | *Deep dive into each subject's skip/attend calculations.* |

| Timetable Grid | Monthly Calendar |
|:---:|:---:|
| ![Timetable Grid](./docs/timetable.png) | ![Monthly Calendar](./docs/calendar.png) |
| *Your weekly schedule at a glance.* | *Track your historical attendance day by day.* |

---

## 🚀 Tech Stack

*   **Frontend Framework**: React 18 & Vite
*   **Styling**: Vanilla CSS (CSS Variables for robust theme management)
*   **State Management**: Zustand
*   **Local Database**: Dexie.js (IndexedDB wrapper)
*   **Icons**: Lucide React
*   **Animations**: Framer Motion
*   **AI/OCR**: Tesseract.js (runs completely on-client)
*   **Date Formatting**: date-fns

---

## 🛠️ Getting Started (Development)

1.  **Clone the repository**
    ```bash
    git clone https://github.com/chandanhastantram/Attendance-manager.git
    cd Attendance-manager
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm run dev
    ```

4.  **Build for production**
    ```bash
    npm run build
    ```

---

## 💡 How the Math Works
Vorn ensures that **On Duty (OD)** marks do not penalize your attendance.
*   **Formula**: `(Attended + OD) / (Attended + OD + Missed) * 100`
*   **Cancelled/Off** classes are ignored completely from the calculation.

---

## 📜 License
This project is completely free and open-source. Build, modify, and distribute as you see fit!
