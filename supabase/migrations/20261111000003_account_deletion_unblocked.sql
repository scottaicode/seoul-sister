-- Account deletion: stop the schema from blocking it (Nov 11 2026).
--
-- Measured on throwaway accounts in production: `auth.admin.deleteUser` answered
-- "Database error deleting user" whenever the person had an AI usage row, a
-- custom shelf product, a landing-chat visitor marked as converted to them, or a
-- conversation with messages. The app's erasure (src/lib/account/erase.ts) now
-- clears each of these itself, checked, before it deletes the login, and does
-- not depend on this file. This file is the second layer: a deletion from
-- anywhere else (the Supabase dashboard, a script) is no longer refused for
-- these reasons. It is NOT an erasure: no key reaches the preview chat, the
-- lead-email row or the stored billing events, and a member who has written a
-- review still cannot be deleted that way (the review-count triggers run as
-- the deleting role). Use the app's route, or src/lib/account/erase.ts.
--
-- 1. Foreign keys that had no ON DELETE action.

ALTER TABLE public.ss_ai_usage
  DROP CONSTRAINT ss_ai_usage_user_id_fkey,
  ADD CONSTRAINT ss_ai_usage_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ss_user_products
  DROP CONSTRAINT ss_user_products_user_id_fkey,
  ADD CONSTRAINT ss_user_products_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.ss_widget_visitors
  DROP CONSTRAINT ss_widget_visitors_converted_user_id_fkey,
  ADD CONSTRAINT ss_widget_visitors_converted_user_id_fkey
    FOREIGN KEY (converted_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ss_treatment_phases
  DROP CONSTRAINT ss_treatment_phases_created_from_conversation_id_fkey,
  ADD CONSTRAINT ss_treatment_phases_created_from_conversation_id_fkey
    FOREIGN KEY (created_from_conversation_id) REFERENCES public.ss_yuri_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.ss_glass_skin_scores
  DROP CONSTRAINT ss_glass_skin_scores_treatment_phase_id_fkey,
  ADD CONSTRAINT ss_glass_skin_scores_treatment_phase_id_fkey
    FOREIGN KEY (treatment_phase_id) REFERENCES public.ss_treatment_phases(id) ON DELETE SET NULL;

ALTER TABLE public.ss_skin_breakdown_history
  DROP CONSTRAINT ss_skin_breakdown_history_treatment_phase_id_fkey,
  ADD CONSTRAINT ss_skin_breakdown_history_treatment_phase_id_fkey
    FOREIGN KEY (treatment_phase_id) REFERENCES public.ss_treatment_phases(id) ON DELETE SET NULL;

-- 2. The message-count trigger fired on DELETE as well as INSERT. Its function
--    only ever reads NEW (it adds one to the conversation's count), so on a
--    delete it changed nothing, but it still ran an UPDATE on
--    ss_yuri_conversations as whoever was deleting. When the login's cascade
--    removes messages, that is the auth service's role, which may not write
--    that table, and the whole deletion failed. Insert only: same counting.

DROP TRIGGER IF EXISTS ss_yuri_message_count ON public.ss_yuri_messages;
CREATE TRIGGER ss_yuri_message_count
  AFTER INSERT ON public.ss_yuri_messages
  FOR EACH ROW EXECUTE FUNCTION public.ss_update_message_count();
