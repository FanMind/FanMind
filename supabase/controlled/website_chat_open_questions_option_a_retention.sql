\set ON_ERROR_STOP on
-- Atomic apply wrapper. The rollback-only acceptance harness includes only the
-- sibling SQL body inside its already-open transaction.
begin;
\ir website_chat_open_questions_option_a_retention_body.sql
commit;
