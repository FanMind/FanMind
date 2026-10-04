# ChatAdmin validation feedback — 2026-09-30

Owner test found that a rejected Character save exposed only a technical validation code. This bounded UI fix maps known Character validation failures to understandable German text, marks the related field red, and clears the marker after the user edits that field. No authorization, schema, AI/provider, Billing, customer-data or auto-send behavior changes.
