import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

export default function AppointmentsPage() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const [form, setForm] = useState({
    title: '',
    leadName: '',
    leadEmail: '',
    company: '',
    scheduledAt: '',
    meetingType: 'product_demo',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptRes, slotsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/appointments/slots', { params: { date: selectedDate } }),
      ]);
      setAppointments(apptRes.data.appointments || []);
      setSlots(slotsRes.data.slots || []);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBookSlot = (slotIso) => {
    setForm({
      title: 'SalesPilot Product Demo',
      leadName: '',
      leadEmail: '',
      company: '',
      scheduledAt: slotIso,
      meetingType: 'product_demo',
      notes: '',
    });
    setShowBookingModal(true);
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/appointments', form);
      toast('Appointment confirmed!', 'success');
      setShowBookingModal(false);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to book appointment', 'error');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      toast(`Appointment marked as ${status}`, 'success');
      setCancelTarget(null);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update appointment', 'error');
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    try {
      await api.put(`/appointments/${rescheduleTarget._id}`, {
        scheduledAt: rescheduleTarget.newDateIso,
        status: 'rescheduled',
      });
      toast('Appointment rescheduled', 'success');
      setRescheduleTarget(null);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to reschedule', 'error');
    }
  };

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();

  const appointmentsByDate = appointments.reduce((acc, a) => {
    if (a.status === 'cancelled') return acc;
    const key = new Date(a.scheduledAt).toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 pro-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h2 className="text-[15px] font-bold">
                {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <button
              onClick={() => handleBookSlot(new Date(`${selectedDate}T14:00:00.000Z`).toISOString())}
              className="pro-btn-primary py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New Booking
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = appointmentsByDate[iso] || 0;
              const isSelected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  onClick={() => setSelectedDate(iso)}
                  className={`flex flex-col items-center justify-center rounded-xl py-2.5 text-xs tabular-nums transition-all border cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 font-bold'
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{day}</span>
                  {count > 0 && (
                    <span className="mt-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pro-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-[15px] font-bold">Available Slots</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">{selectedDate}</p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {slots.map((slot) => (
              <div
                key={slot.iso}
                className="flex items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-800 px-3.5 py-2.5 text-xs"
              >
                <span className="font-semibold tabular-nums">{slot.timeLabel}</span>
                {slot.available ? (
                  <button
                    onClick={() => handleBookSlot(slot.iso)}
                    className="rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                  >
                    Book
                  </button>
                ) : (
                  <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-400">
                    Reserved
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pro-card p-6">
        <h2 className="text-[15px] font-bold mb-4">Scheduled Appointments</h2>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : appointments.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No appointments scheduled yet. Book a slot above or let SalesPilot AI schedule one during a call.
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm">{appt.title}</h3>
                    <StatusBadge value={appt.status} />
                    {appt.bookedBy === 'ai_agent' && (
                      <span className="rounded-md bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                        AI Booked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {appt.leadName} {appt.company ? `(${appt.company})` : ''} ·{' '}
                    {new Date(appt.scheduledAt).toLocaleString()} · {appt.durationMinutes}m
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {appt.status !== 'confirmed' && appt.status !== 'cancelled' && (
                    <button
                      onClick={() => handleStatusUpdate(appt._id, 'confirmed')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                    </button>
                  )}
                  {appt.status !== 'cancelled' && (
                    <>
                      <button
                        onClick={() =>
                          setRescheduleTarget({
                            ...appt,
                            newDateIso: new Date(appt.scheduledAt).toISOString().slice(0, 16),
                          })
                        }
                        className="pro-btn-secondary px-3 py-1.5 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                      </button>
                      <button
                        onClick={() => setCancelTarget(appt)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateAppointment} className="w-full max-w-md pro-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Confirm Booking</h2>
              <button type="button" onClick={() => setShowBookingModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              required
              placeholder="Meeting Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="pro-input"
            />
            <input
              required
              placeholder="Prospect Name"
              value={form.leadName}
              onChange={(e) => setForm({ ...form, leadName: e.target.value })}
              className="pro-input"
            />
            <input
              type="email"
              placeholder="Prospect Email"
              value={form.leadEmail}
              onChange={(e) => setForm({ ...form, leadEmail: e.target.value })}
              className="pro-input"
            />
            <input
              type="datetime-local"
              required
              value={form.scheduledAt ? form.scheduledAt.slice(0, 16) : ''}
              onChange={(e) => setForm({ ...form, scheduledAt: new Date(e.target.value).toISOString() })}
              className="pro-input"
            />
            <textarea
              rows={2}
              placeholder="Agenda / Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="pro-input"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowBookingModal(false)} className="pro-btn-secondary">
                Close
              </button>
              <button type="submit" className="pro-btn-primary">
                Confirm Booking
              </button>
            </div>
          </form>
        </div>
      )}

      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleReschedule} className="w-full max-w-sm pro-card p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold">Reschedule Appointment</h2>
            <input
              type="datetime-local"
              required
              value={rescheduleTarget.newDateIso}
              onChange={(e) => setRescheduleTarget({ ...rescheduleTarget, newDateIso: e.target.value })}
              className="pro-input"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRescheduleTarget(null)} className="pro-btn-secondary">
                Cancel
              </button>
              <button type="submit" className="pro-btn-primary">
                Save New Time
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Appointment"
        message={`Cancel "${cancelTarget?.title}"?`}
        confirmLabel="Cancel Booking"
        onConfirm={() => handleStatusUpdate(cancelTarget._id, 'cancelled')}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
