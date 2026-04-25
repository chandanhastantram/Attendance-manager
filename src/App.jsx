import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TopBar from './components/layout/TopBar.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import ToastContainer from './components/common/ToastContainer.jsx';
import HomePage from './pages/HomePage.jsx';
import SubjectsPage from './pages/SubjectsPage.jsx';
import TimetablePage from './pages/TimetablePage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ScanPage from './pages/ScanPage.jsx';
import PortalPage from './pages/PortalPage.jsx';
import useSettingsStore from './stores/useSettingsStore.js';

export default function App() {
  const loadSettings = useSettingsStore(s => s.loadSettings);
  useEffect(() => { loadSettings(); }, []);

  return (
    <BrowserRouter>
      <div className="app-wrap">
        <ToastContainer />
        <TopBar />
        <div className="page-content">
          <Routes>
            <Route path="/"          element={<HomePage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/subjects"  element={<SubjectsPage />} />
            <Route path="/calendar"  element={<CalendarPage />} />
            <Route path="/reports"   element={<ReportsPage />} />
            <Route path="/scan"      element={<ScanPage />} />
            <Route path="/portal"    element={<PortalPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
