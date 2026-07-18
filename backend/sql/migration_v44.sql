-- migration_v44.sql
-- Permitir employee_id NULL en taps para registrar taps de tarjetas desconocidas.
-- Flujo: tag sin empleado → tap con deny_reason='card_unknown' y employee_id=NULL
--        → aparece en "NFCs sin asignar" → admin la asigna a un empleado.

ALTER TABLE taps ALTER COLUMN employee_id DROP NOT NULL;
