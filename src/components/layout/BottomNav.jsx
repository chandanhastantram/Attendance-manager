import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, Calendar, LayoutGrid } from 'lucide-react';

const navItems = [
  { path: '/',           icon: Home,       label: 'Today'     },
  { path: '/timetable',  icon: LayoutGrid, label: 'Timetable' },
  { path: '/calendar',   icon: Calendar,   label: 'Calendar'  },
  { path: '/subjects',   icon: BookOpen,   label: 'Subjects'  },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            id={`nav-${item.label.toLowerCase()}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
