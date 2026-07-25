
ALTER TABLE public.profiles
  ADD COLUMN period_start_month integer NOT NULL DEFAULT 1,
  ADD COLUMN period_start_day integer NOT NULL DEFAULT 1,
  ADD COLUMN period_end_month integer NOT NULL DEFAULT 12,
  ADD COLUMN period_end_day integer NOT NULL DEFAULT 31;
