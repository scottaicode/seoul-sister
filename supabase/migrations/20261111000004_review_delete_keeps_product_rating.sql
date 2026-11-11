-- Deleting the last local review of a product no longer blanks its rating
-- (Nov 11 2026).
--
-- ss_products.rating_avg is filled by the catalog pipeline. This trigger
-- function recomputed it from our own ss_reviews on every insert, rating
-- change and delete, so when a product's only local review was deleted the
-- average of nothing (NULL) was written over the product's rating. Account
-- deletion removes a member's reviews, and when this was written all 20
-- reviewed products had exactly one local review: deleting either reviewer
-- would have blanked the rating on every product they reviewed, which feeds
-- search ordering, the best-of pages and the rating in structured data.
--
-- Now: when no local review remains, the rating is left as it is.

CREATE OR REPLACE FUNCTION public.ss_update_product_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  target uuid := COALESCE(NEW.product_id, OLD.product_id);
  local_avg numeric;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1) INTO local_avg
  FROM public.ss_reviews
  WHERE product_id = target;

  IF local_avg IS NOT NULL THEN
    UPDATE public.ss_products SET rating_avg = local_avg WHERE id = target;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
