-- Remove the retired spiritual/energetic analysis field from existing reports.
-- FanMind communication analysis must not infer religious, spiritual or other
-- protected/sensitive attributes from contact conversations.

update public.fan_analysis_reports
set
  report_json = report_json - 'spirituell',
  updated_at = now()
where report_json ? 'spirituell';

comment on column public.fan_analysis_reports.report_json is
  'Practical communication overview. Must not contain diagnoses or inferred protected/sensitive attributes, including religious or spiritual profiling.';
