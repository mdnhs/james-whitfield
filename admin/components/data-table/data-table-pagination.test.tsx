// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { DataTablePagination } from "./data-table-pagination"

it("pages forward and back within bounds", async () => {
  const onPageChange = vi.fn()
  render(
    <DataTablePagination
      page={1}
      pageSize={20}
      total={45}
      onPageChange={onPageChange}
    />
  )
  expect(screen.getByText("1–20 of 45")).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  await userEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(onPageChange).toHaveBeenCalledWith(2)
})

it("stops on the last page", () => {
  render(
    <DataTablePagination
      page={3}
      pageSize={20}
      total={45}
      onPageChange={() => {}}
    />
  )
  expect(screen.getByText("41–45 of 45")).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})
