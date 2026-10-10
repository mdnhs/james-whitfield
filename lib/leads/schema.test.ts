import { describe, expect, it } from "vitest"

import { LeadInput, LeadSubmission } from "./schema"

const valid = {
  name: " Ann ",
  email: " Ann@Example.COM ",
  phone: "087 123 4567",
  topic: "anxiety",
  format: "online",
  message: "Hello",
  consent: true,
}

describe("LeadInput", () => {
  it("trims, lower-cases the email and keeps the phone shape", () => {
    const parsed = LeadInput.parse(valid)
    expect(parsed).toMatchObject({
      name: "Ann",
      email: "ann@example.com",
      phone: "087 123 4567",
    })
  })
  it.each([
    ["name", ""],
    ["email", "nope"],
    ["topic", "Not A Slug"],
    ["consent", false],
    ["phone", "call me maybe"],
    ["message", "x".repeat(5001)],
  ])("rejects %s = %j", (key, value) => {
    expect(LeadInput.safeParse({ ...valid, [key]: value }).success).toBe(false)
  })
  it("treats an empty phone as absent", () => {
    expect(LeadInput.parse({ ...valid, phone: "" }).phone).toBeUndefined()
  })
})

describe("LeadSubmission", () => {
  it("defaults the hidden fields and refuses an off-site source path", () => {
    const parsed = LeadSubmission.parse(valid)
    expect(parsed).toMatchObject({
      website: "",
      stamp: "",
      sourcePath: "/",
      attribution: { referrer: "", utm: {} },
    })
    expect(
      LeadSubmission.safeParse({ ...valid, sourcePath: "https://evil.example" })
        .success
    ).toBe(false)
    expect(
      LeadSubmission.safeParse({
        ...valid,
        attribution: { utm: { utm_source: "x".repeat(201) } },
      }).success
    ).toBe(false)
  })
})
