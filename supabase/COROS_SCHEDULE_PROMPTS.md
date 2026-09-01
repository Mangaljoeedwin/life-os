# Scheduled task prompts

These prompts intentionally contain no Supabase credentials. The private Life OS token belongs only in the custom app endpoint configuration.

## COROS Morning Sync

```text
Run the COROS morning sync for Life OS using Asia/Kolkata dates and time.

Use the connected COROS app to retrieve today's available sleep data and daily metrics. Also inspect yesterday for late-arriving or revised daily totals and activities so the previous day can be reconciled.

For every date inspected, call the Life OS Sync tool `upsert_coros_daily_snapshot` once with schema_version 1. Use `run_type: "morning"` for today and `run_type: "reconciliation"` for yesterday. Set `record_date` to the actual Asia/Kolkata calendar date represented by the COROS data, `timezone` to `Asia/Kolkata`, and `captured_at` to the current ISO 8601 timestamp with an offset.

Pass exact values returned by COROS. Do not estimate, infer, convert missing values to zero, or combine multiple activities into one. Include daily steps, calories, exercise minutes, sleep duration in whole minutes, sleep score and sleep status only when COROS provides them. Include every relevant Walk, Run and Jump Rope activity as a separate activity. Use COROS's stable activity identifier as `coros_activity_id`; include its exact type, date, start time, duration, distance in kilometres, jump count and calories when available.

Use `sync_status: "complete"` only when the expected data for that date is available, `"partial"` when some fields are not yet available, `"missing"` when COROS has no record for the date, and `"error"` only when the COROS read itself failed. For missing fields, omit the field or send null; never send zero unless COROS explicitly reports zero.

Life OS applies these rules itself: daily steps >=10,000; one Walk or Run >=5.00 km; one Jump Rope session >=1,000 jumps; sleep duration >450 minutes. Do not tick tasks directly and do not add together shorter activities or skipping sessions.

After each Life OS tool call, check its response. Only report that Life OS was updated when it returns `saved=true`. Finish with a concise summary listing the date or dates saved, exact available values, completed rules, pending rules, and any missing COROS data. If the Life OS write fails, clearly say it was not saved and include the returned error.
```

## COROS Night Sync

```text
Run the COROS night sync for Life OS using Asia/Kolkata dates and time.

Use the connected COROS app to retrieve today's near-final daily metrics and all of today's recorded activities. Then call the Life OS Sync tool `upsert_coros_daily_snapshot` exactly once for today with schema_version 1, `run_type: "night"`, the correct Asia/Kolkata `record_date`, `timezone: "Asia/Kolkata"`, and the current `captured_at` ISO 8601 timestamp with an offset.

Pass exact values returned by COROS. Do not estimate, infer, convert missing values to zero, or combine multiple activities into one. Include daily steps, calories and exercise minutes when available. Include sleep fields only if COROS returns them for this same record date. Include every Walk, Run and Jump Rope activity as a separate activity. Use COROS's stable activity identifier as `coros_activity_id`; include its exact type, date, start time, duration, distance in kilometres, jump count and calories when available.

Use `sync_status: "complete"` only when the expected night data is available, `"partial"` when some fields are not yet available, `"missing"` when COROS has no record for today, and `"error"` only when the COROS read itself failed. For missing fields, omit the field or send null; never send zero unless COROS explicitly reports zero.

Life OS applies these rules itself: daily steps >=10,000; one Walk or Run >=5.00 km; one Jump Rope session >=1,000 jumps; sleep duration >450 minutes. Do not tick tasks directly and do not add together shorter activities or skipping sessions.

Check the Life OS tool response. Only report that Life OS was updated when it returns `saved=true`. Finish with a concise summary of the exact available values, completed rules, pending rules and missing COROS data. If the Life OS write fails, clearly say it was not saved and include the returned error.
```

