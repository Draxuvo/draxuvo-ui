import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Select } from "./select"

describe("Select", () => {
  it("usa la altura del panel y dibuja su propia flecha oculta a lectores", () => {
    const { container } = render(
      <Select aria-label="Prioridad">
        <option value="a">A</option>
      </Select>,
    )
    const select = screen.getByRole("combobox", { name: "Prioridad" })
    expect(select.className).toContain("h-10")
    expect(select.className).toContain("md:h-9")
    expect(select.className).toContain("appearance-none")
    const chevron = container.querySelector("svg")
    expect(chevron).not.toBeNull()
    expect(chevron?.getAttribute("aria-hidden")).toBe("true")
  })

  it("reenvía onChange, ref y disabled al select nativo", async () => {
    const ref = createRef<HTMLSelectElement>()
    const onChange = vi.fn()
    render(
      <Select aria-label="Tipo" ref={ref} onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    )
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "b")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(ref.current?.value).toBe("b")
  })

  it("conserva el estado deshabilitado y el de error", () => {
    render(
      <Select aria-label="Zona" disabled aria-invalid="true">
        <option value="a">A</option>
      </Select>,
    )
    const select = screen.getByLabelText("Zona") as HTMLSelectElement
    expect(select.disabled).toBe(true)
    expect(select.getAttribute("aria-invalid")).toBe("true")
  })

  it("aplica el ancho que pide quien lo usa en el contenedor", () => {
    const { container } = render(
      <Select aria-label="Filtro" className="sm:w-auto">
        <option value="a">A</option>
      </Select>,
    )
    expect(container.firstElementChild?.className).toContain("sm:w-auto")
  })
})
