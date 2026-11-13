-- Services already pointing at a page by hand-typed page_path keep that
-- link: the page becomes the service's detail page (its switch shows "on").
UPDATE "pages" SET "service_id" = "services"."id"
FROM "services"
WHERE "pages"."path" = "services"."page_path"
  AND "services"."page_path" <> ''
  AND "pages"."system_key" IS NULL
  AND "pages"."service_id" IS NULL;
