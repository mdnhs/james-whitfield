import { expect, it } from "vitest"
import { serviceIntro } from "@/blocks/service"
import { toFields } from "./to-fields"
// A rich text field that still accepts plain text keeps the Tiptap editor.
it("intro body uses the rich text widget", () => {
  const body = toFields(serviceIntro.schema, {}).find((f) => f.name === "body")
  expect(body?.widget).toBe("richtext")
})
