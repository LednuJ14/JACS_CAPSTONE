import React, { useEffect, useMemo, useState } from 'react';
import { X, Calendar } from 'lucide-react';

// UI-only modal showing staff schedule grid
const StaffScheduleModal = ({ isOpen, onClose, shifts = [] }) => {
  if (!isOpen) return null;

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [items, setItems] = useState(Array.isArray(shifts) && shifts.length ? shifts : getStaffShifts());
  useEffect(() => {
    if (!isOpen) return;
    setItems(Array.isArray(shifts) && shifts.length ? shifts : getStaffShifts());
  }, [isOpen, shifts]);
  const [adding, setAdding] = useState(false);
  const [newShift, setNewShift] = useState({ day: 'Mon', time: '', role: '' });

  const monthYear = useMemo(() => {
    return `${months[viewMonth]} ${viewYear}`;
  }, [viewMonth, viewYear]);

  const years = useMemo(() => {
    const span = 11; // 11-year window centered around current
    const start = now.getFullYear() - 5;
    return Array.from({ length: span + 1 }, (_, i) => start + i);
  }, [now]);

  const handleAddShift = () => {
    if (!newShift.time.trim() || !newShift.role.trim()) return;
    setItems(prev => [
      ...prev,
      { day: newShift.day, time: newShift.time, role: newShift.role, id: Date.now() }
    ]);
    setNewShift({ day: 'Mon', time: '', role: '' });
    setAdding(false);
  };

  // Build a 6x7 full-month matrix (Mon-Sun) for viewMonth/viewYear
  const calendarCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    // Convert JS getDay() (Sun=0..Sat=6) to Mon=0..Sun=6
    const startOffset = (first.getDay() + 6) % 7; // number of cells before day 1
    const totalCells = 42; // 6 weeks
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      let dayNum;
      let date;
      let inCurrent = false;
      if (i < startOffset) {
        // previous month
        dayNum = prevMonthDays - startOffset + 1 + i;
        date = new Date(viewYear, viewMonth - 1, dayNum);
      } else if (i >= startOffset + daysInMonth) {
        // next month
        dayNum = i - (startOffset + daysInMonth) + 1;
        date = new Date(viewYear, viewMonth + 1, dayNum);
      } else {
        dayNum = i - startOffset + 1;
        date = new Date(viewYear, viewMonth, dayNum);
        inCurrent = true;
      }
      const today = new Date();
      const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
      cells.push({ date, inCurrent, isToday });
    }
    return cells;
  }, [viewMonth, viewYear]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">My Schedule</h2>
              <p className="text-sm text-gray-500">{monthYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const m = viewMonth - 1;
              if (m < 0) { setViewMonth(11); setViewYear(y => y - 1); } else { setViewMonth(m); }
            }} className="px-3 py-1.5 border rounded-lg text-xs sm:text-sm hover:bg-gray-50">Prev</button>
            <button onClick={() => { setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }} className="px-3 py-1.5 border rounded-lg text-xs sm:text-sm hover:bg-gray-50">Today</button>
            <button onClick={() => {
              const m = viewMonth + 1;
              if (m > 11) { setViewMonth(0); setViewYear(y => y + 1); } else { setViewMonth(m); }
            }} className="px-3 py-1.5 border rounded-lg text-xs sm:text-sm hover:bg-gray-50">Next</button>
            {/* Add Schedule button removed for full-calendar-only view */}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Month & Year controls (fixed, non-scrolling) */}
        <div className="px-4 sm:px-4 py-4 mb-1 border-b bg-white">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto bg-white">
              {months.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setViewMonth(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors whitespace-nowrap ${idx === viewMonth ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto bg-white">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setViewYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm border transition-colors ${y === viewYear ? 'bg-gray-900 text-white border-gray-900 shadow' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable calendar area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          {adding && (
            <div className="bg-white border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Day</label>
                  <select value={newShift.day} onChange={(e) => setNewShift(s => ({ ...s, day: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time</label>
                  <input value={newShift.time} onChange={(e) => setNewShift(s => ({ ...s, time: e.target.value }))} placeholder="e.g., 8:00 AM - 4:00 PM" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Role</label>
                  <input value={newShift.role} onChange={(e) => setNewShift(s => ({ ...s, role: e.target.value }))} placeholder="e.g., Maintenance" className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <button onClick={handleAddShift} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Add</button>
              </div>
            </div>
          )}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 text-xs text-gray-500 px-4 py-2 border-b bg-gray-50">
              {days.map((d) => (
                <div key={d} className="uppercase tracking-wide font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0">
              {calendarCells.map((cell, idx) => {
                const jsDay = cell.date.getDay(); // Sun=0..Sat=6
                const monIdx = (jsDay + 6) % 7; // Mon=0..Sun=6
                const dayName = days[monIdx];
                const dayShifts = items.filter(s => s.day === dayName);
                return (
                  <div key={`${cell.date.toISOString()}-${idx}`} className={`min-h-[120px] md:min-h-[140px] border-r last:border-r-0 border-b p-2 md:p-3 hover:bg-gray-50/60 transition-colors ${cell.inCurrent ? '' : 'bg-gray-50/40'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] md:text-xs ${cell.inCurrent ? 'text-gray-700' : 'text-gray-400'}`}>{cell.date.getDate()}</span>
                      {cell.isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">Today</span>}
                    </div>
                    <div className="space-y-1">
                      {dayShifts.map((s) => (
                        <div key={`${cell.date.toISOString()}-${s.time}-${s.role}`} className={`text-[10px] md:text-[11px] border rounded-md px-2 py-0.5 md:py-1 shadow-sm ${((role) => { const r=(role||'').toLowerCase(); if(r.includes('maintenance')) return 'bg-rose-50 text-rose-700 border-rose-200'; if(r.includes('front')) return 'bg-blue-50 text-blue-700 border-blue-200'; if(r.includes('security')) return 'bg-amber-50 text-amber-800 border-amber-200'; if(r.includes('admin')) return 'bg-purple-50 text-purple-700 border-purple-200'; return 'bg-slate-50 text-slate-700 border-slate-200'; })(s.role)}`}>
                          <div className="font-medium truncate leading-tight">{s.role}</div>
                          <div className="opacity-80 leading-tight">{s.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {(!items || items.length === 0) && (
            <div className="bg-white border rounded-xl p-8 text-center text-sm text-gray-600 mt-4">
              No schedule assigned.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffScheduleModal;


