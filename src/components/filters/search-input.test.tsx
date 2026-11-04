import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Detector } from "@/lib/scan/detector";
import { SearchInput } from "./search-input";

function installCamera() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }], getVideoTracks: () => [{ getCapabilities: () => ({}) }] })) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(async () => {}) });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
}

const detector = (value: string): Detector => ({ detect: vi.fn(async () => [{ value }]) });

beforeEach(installCamera);

describe("SearchInput con cámara (spec 056)", () => {
  it("sin scannable no hay botón de cámara", () => {
    renderWithProviders(<SearchInput value="" onSearch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Escanear con cámara" })).toBeNull();
  });

  it("el código leído se busca al instante, llena el campo y cierra la cámara", async () => {
    const onSearch = vi.fn();
    const onScan = vi.fn();
    renderWithProviders(<SearchInput value="" onSearch={onSearch} scannable onScan={onScan} detector={detector("7501234567890")} />);

    await userEvent.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("7501234567890"), { timeout: 2000 });
    expect(onScan).toHaveBeenCalledWith("7501234567890");
    expect(screen.getByRole("searchbox")).toHaveValue("7501234567890");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("escribir sigue esperando el rato de siempre antes de buscar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearch = vi.fn();
    renderWithProviders(<SearchInput value="" onSearch={onSearch} scannable />);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(screen.getByRole("searchbox"), "abc");
    expect(onSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(450);
    expect(onSearch).toHaveBeenCalledWith("abc");
    vi.useRealTimers();
  });
});
