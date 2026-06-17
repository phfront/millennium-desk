import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { formatDateKey, fromDateKey, toDateKey } from "../../utils/date";
import "./DatePicker.css";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function buildCalendar(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const startDate = new Date(year, month, 1 - startOffset);
  const cells: CalendarCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index,
    );
    cells.push({
      date,
      inMonth: date.getMonth() === month,
    });
  }

  return cells;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  clearable?: boolean;
  defaultOpen?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  clearable = true,
  defaultOpen = false,
  placeholder = "Selecionar data",
  "aria-label": ariaLabel = "Selecionar data",
}: DatePickerProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [monthPanelOpen, setMonthPanelOpen] = useState(false);
  const selectedDate = value ? fromDateKey(value) : null;
  const today = new Date();
  const [viewYear, setViewYear] = useState(
    () => selectedDate?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    () => selectedDate?.getMonth() ?? today.getMonth(),
  );

  useEffect(() => {
    if (!open || !selectedDate) return;
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMonthPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setMonthPanelOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const cells = buildCalendar(viewYear, viewMonth);

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDate = (date: Date) => {
    onChange(toDateKey(date));
    setOpen(false);
    setMonthPanelOpen(false);
  };

  return (
    <div className="datepicker" ref={rootRef}>
      <button
        type="button"
        className="datepicker-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setMonthPanelOpen(false);
        }}
      >
        <span
          className={value ? "datepicker-value" : "datepicker-value placeholder"}
        >
          {value ? formatDateKey(value) : placeholder}
        </span>
        <svg
          className="datepicker-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={listboxId}
            role="dialog"
            aria-label="Calendario"
            className="datepicker-popover"
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <div className="datepicker-header">
              <button
                type="button"
                className="datepicker-month-select"
                onClick={() => setMonthPanelOpen((current) => !current)}
              >
                {MONTHS[viewMonth]} {viewYear}
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {!monthPanelOpen && (
                <div className="datepicker-nav">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() => moveMonth(-1)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M15 6l-6 6 6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Proximo mes"
                    onClick={() => moveMonth(1)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {monthPanelOpen ? (
              <>
                <div className="datepicker-year-row">
                  <button
                    type="button"
                    aria-label="Ano anterior"
                    onClick={() => setViewYear((current) => current - 1)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M15 6l-6 6 6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <strong>{viewYear}</strong>
                  <button
                    type="button"
                    aria-label="Proximo ano"
                    onClick={() => setViewYear((current) => current + 1)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="datepicker-month-panel">
                  {MONTHS.map((month, index) => (
                    <button
                      key={month}
                      type="button"
                      className={viewMonth === index ? "selected" : ""}
                      onClick={() => {
                        setViewMonth(index);
                        setMonthPanelOpen(false);
                      }}
                    >
                      {month.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="datepicker-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((weekday) => (
                    <span key={weekday} className="datepicker-weekday">
                      {weekday}
                    </span>
                  ))}
                </div>
                <div className="datepicker-grid" role="grid">
                  {cells.map((cell) => {
                    const selected =
                      selectedDate !== null && isSameDay(cell.date, selectedDate);
                    const isToday = isSameDay(cell.date, today);

                    return (
                      <button
                        key={toDateKey(cell.date)}
                        type="button"
                        role="gridcell"
                        className={[
                          "datepicker-day",
                          !cell.inMonth ? "outside" : "",
                          selected ? "selected" : "",
                          isToday ? "today" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectDate(cell.date)}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="datepicker-footer">
              {clearable ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setMonthPanelOpen(false);
                  }}
                >
                  Limpar
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  onChange(toDateKey(now));
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  setOpen(false);
                  setMonthPanelOpen(false);
                }}
              >
                Hoje
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
