import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { installFakeAudio } from "@/test/audio";
import { resetEngine } from "@/lib/sounds/engine";
import { SoundSettings } from "../sound-settings";

let audio: ReturnType<typeof installFakeAudio>;

beforeEach(() => {
  resetEngine();
  window.localStorage.clear();
  audio = installFakeAudio();
});
afterEach(() => vi.unstubAllGlobals());

async function open(volume = 0.6) {
  const user = userEvent.setup();
  const view = renderWithProviders(<SoundSettings volume={volume} />);
  await user.click(screen.getByRole("button", { name: "Sonidos" }));
  return Object.assign(user, { unmount: view.unmount });
}

const stored = () => JSON.parse(window.localStorage.getItem("draxuvo.sound-choices") ?? "{}");

describe("ajustes de sonido", () => {
  it("lista las cinco alertas con su sonido actual", async () => {
    await open();
    expect(screen.getByLabelText("Comanda nueva en cocina")).toHaveValue("cocina");
    expect(screen.getByLabelText("Comanda nueva en barra")).toHaveValue("barra");
    expect(screen.getByLabelText("Comanda nueva en otra estación")).toHaveValue("otra");
    expect(screen.getByLabelText("Comanda atrasada")).toHaveValue("urgente");
    expect(screen.getByLabelText("Comanda lista")).toHaveValue("listo");
  });

  it("el catálogo ofrece al menos 8 sonidos con nombre", async () => {
    await open();
    const options = within(screen.getByLabelText("Comanda lista")).getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(8);
    expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining(["Campana", "Marimba", "Gota"]));
  });

  it("elegir un sonido lo guarda y sobrevive a un montaje nuevo", async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Comanda lista"), "marimba");
    expect(stored()).toEqual({ ready: "marimba" });
    user.unmount();
    await open();
    expect(screen.getByLabelText("Comanda lista")).toHaveValue("marimba");
  });

  it("probar suena al volumen de la superficie aun silenciada y corta el anterior", async () => {
    const user = await open(0.6);
    await user.click(screen.getByRole("button", { name: "Probar Cocina" }));
    await waitFor(() => expect(audio.played).toHaveLength(1));
    expect(audio.played[0].volume).toBe(0.6);
    await user.click(screen.getAllByRole("button", { name: /^Probar / })[1]);
    await waitFor(() => expect(audio.played).toHaveLength(2));
    expect(audio.played[0].url).not.toBe(audio.played[1].url);
  });

  it("si no se puede reproducir avisa", async () => {
    audio.fetchMock.mockResolvedValue({ ok: false, status: 404 } as never);
    const user = await open();
    await user.click(screen.getAllByRole("button", { name: /^Probar / })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo reproducir el sonido");
  });

  it("avisa cuando dos alertas suenan igual, sin impedir guardar", async () => {
    const user = await open();
    expect(screen.queryByText("Suena igual que otra alerta")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Comanda nueva en barra"), "cocina");
    expect(stored()).toEqual({ new_bar: "cocina" });
    expect(screen.getAllByText("Suena igual que otra alerta")).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Comanda nueva en barra"), "barra");
    expect(screen.queryByText("Suena igual que otra alerta")).not.toBeInTheDocument();
  });

  it("restablece una alerta o todas", async () => {
    const user = await open();
    await user.selectOptions(screen.getByLabelText("Comanda lista"), "gota");
    await user.selectOptions(screen.getByLabelText("Comanda atrasada"), "pulso");
    await user.selectOptions(screen.getByLabelText("Comanda nueva en barra"), "timbre");
    await user.click(screen.getByRole("button", { name: "Restablecer: Comanda lista" }));
    expect(stored()).toEqual({ urgent: "pulso", new_bar: "timbre" });
    await user.click(screen.getByRole("button", { name: "Restablecer todo" }));
    expect(stored()).toEqual({});
    expect(screen.getByLabelText("Comanda lista")).toHaveValue("listo");
    expect(screen.queryByRole("button", { name: "Restablecer todo" })).not.toBeInTheDocument();
  });
});
