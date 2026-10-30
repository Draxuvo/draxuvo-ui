import axios from "axios"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiClient } from "./api"
import { markSessionEnding } from "./session-end"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const adapter = vi.fn()

beforeEach(() => {
  adapter.mockReset().mockResolvedValue({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} })
  apiClient.defaults.adapter = adapter
})

afterEach(() => {
  localStorage.clear()
})

describe("apiClient al cerrar sesión", () => {
  it("manda la petición con el token mientras la sesión sigue abierta", async () => {
    localStorage.setItem("auth_token", "abc")
    await apiClient.get("/api/v1/dashboard")

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer abc")
  })

  it("no envía peticiones nuevas cuando la sesión se está cerrando, ni avisa de un error", async () => {
    markSessionEnding()

    const error = await apiClient.get("/api/v1/dashboard").catch((e) => e)

    expect(axios.isCancel(error)).toBe(true)
    expect(adapter).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
