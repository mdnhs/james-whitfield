// Desktop only (admin/content/**): it moves the shared intake account's
// "seen" instant, so one project at a time.
import { expect, test } from "@playwright/test"

import { runSql } from "../../support/db"
import { STORAGE } from "../../support/storage"

test.use({ storageState: STORAGE.intake })

// The shell still renders the static NotificationsButton until it is swapped
// for NotificationsBell (admin/modules/notifications/notifications-bell.tsx);
// drop `.fixme` with that one-line swap. Until then the bell is covered by
// its component test and tests/integration/api/notifications.test.ts.
test.fixme("a new enquiry rings the bell, and opening it marks it read", async ({
  page,
}) => {
  const stamp = Date.now()
  await runSql(
    "insert into leads (name, email, topic_slug) values ($1, $2, 'anxiety')",
    [`Nora ${stamp}`, `nora-${stamp}@example.com`]
  )
  await page.goto("/admin")
  const ringing = page.getByRole("button", {
    name: /^Notifications \(\d+\+? unread\)$/,
  })
  await expect(ringing).toBeVisible()
  await ringing.click()
  const item = page
    .getByRole("list", { name: "Notifications" })
    .getByRole("link")
    .filter({ hasText: "From Nora" })
    .first()
  await expect(item).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true })
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Notifications", exact: true }).click()
  await item.click()
  await expect(page).toHaveURL(/\/admin\/leads\?lead=[0-9a-f-]{36}$/)
})
