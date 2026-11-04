import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Detector } from "@/lib/scan/detector";
import { CameraDialog } from "../camera-dialog";
import { ScanInput } from "../scan-input";

const stop = vi.fn();
let permission: "granted" | "denied" | "missing" = "granted";

function installCamera() {
  stop.mockClear();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value:
      permission === "missing"
        ? undefined
        : {
            getUserMedia: vi.fn(async () => {
              if (permission === "denied") throw Object.assign(new Error("no"), { name: "NotAllowedError" });
              return { getTracks: () => [{ stop }], getVideoTracks: () => [{ stop, getCapabilities: () => ({}) }] };
            }),
          },
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(async () => {}) });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
}

function detectorOf(frames: Array<Array<{ value: string; center?: { x: number; y: number } }>>): Detector {
  let i = 0;
  return { detect: vi.fn(async () => frames[Math.min(i++, frames.length - 1)]) };
}

beforeEach(() => {
  permission = "granted";
  installCamera();
});
afterEach(() => vi.useRealTimers());

describe("CameraDialog (spec 056)", () => {
  it("lee un código sostenido varios cuadros una sola vez y apaga la cámara al cerrar", async () => {
    const onScan = vi.fn();
    const frame = [{ value: "7501234567890" }];
    const { rerender } = renderWithProviders(
      <CameraDialog open onOpenChange={() => {}} onScan={onScan} detector={detectorOf([frame, frame, frame, frame, frame])} />,
    );
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("7501234567890"), { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Leído: 7501234567890")).toBeInTheDocument();

    rerender(<CameraDialog open={false} onOpenChange={() => {}} onScan={onScan} detector={detectorOf([[]])} />);
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it("con varios códigos en cuadro lee el más cercano al centro", async () => {
    const onScan = vi.fn();
    const frame = [
      { value: "LEJOS", center: { x: 10, y: 10 } },
      { value: "CENTRO", center: { x: 320, y: 240 } },
    ];
    renderWithProviders(<CameraDialog open onOpenChange={() => {}} onScan={onScan} detector={detectorOf([frame])} />);
    await waitFor(() => expect(onScan).toHaveBeenCalledWith("CENTRO"), { timeout: 2000 });
    expect(onScan).not.toHaveBeenCalledWith("LEJOS");
  });

  it("avisa un código no válido sin llamar a onScan", async () => {
    const onScan = vi.fn();
    renderWithProviders(<CameraDialog open onOpenChange={() => {}} onScan={onScan} detector={detectorOf([[{ value: "ñandú" }]])} />);
    await screen.findByText("Código no válido, intenta de nuevo.", undefined, { timeout: 2000 });
    expect(onScan).not.toHaveBeenCalled();
  });

  it("explica el permiso negado y la falta de cámara", async () => {
    permission = "denied";
    installCamera();
    const first = renderWithProviders(<CameraDialog open onOpenChange={() => {}} onScan={vi.fn()} detector={detectorOf([[]])} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/permiso fue negado/);
    first.unmount();

    permission = "missing";
    installCamera();
    renderWithProviders(<CameraDialog open onOpenChange={() => {}} onScan={vi.fn()} detector={detectorOf([[]])} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/no tiene una cámara/);
  });

  it("solo el texto sale por onScan: nunca una imagen (FR-018)", async () => {
    const onScan = vi.fn();
    renderWithProviders(<CameraDialog open onOpenChange={() => {}} onScan={onScan} detector={detectorOf([[{ value: "123" }]])} />);
    await waitFor(() => expect(onScan).toHaveBeenCalled(), { timeout: 2000 });
    expect(onScan.mock.calls[0]).toEqual(["123"]);
  });

  it("una lectura en proceso al cerrar se aplica una sola vez", async () => {
    let finish: () => void = () => {};
    const onScan = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { rerender } = renderWithProviders(
      <CameraDialog open onOpenChange={() => {}} onScan={onScan} detector={detectorOf([[{ value: "999" }]])} />,
    );
    await waitFor(() => expect(onScan).toHaveBeenCalledTimes(1), { timeout: 2000 });
    rerender(<CameraDialog open={false} onOpenChange={() => {}} onScan={onScan} detector={detectorOf([[]])} />);
    await act(async () => finish());
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});

describe("ScanInput con cámara (spec 056)", () => {
  it("escribir a mano, pistola y cámara dan el mismo resultado", async () => {
    const onScan = vi.fn();
    renderWithProviders(<ScanInput onScan={onScan} detector={detectorOf([[{ value: "555" }]])} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Código de barras"), "  111  {Enter}");
    expect(onScan).toHaveBeenLastCalledWith("111");
    await user.keyboard("{Enter}");
    expect(onScan).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    await waitFor(() => expect(onScan).toHaveBeenLastCalledWith("555"), { timeout: 2000 });
  });

  it("cierra con Esc y devuelve el foco al campo", async () => {
    renderWithProviders(<ScanInput onScan={vi.fn()} detector={detectorOf([[]])} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Escanear con cámara" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText("Código de barras")).toHaveFocus());
  });

  it("sin allowCamera no muestra el botón", () => {
    renderWithProviders(<ScanInput onScan={vi.fn()} allowCamera={false} />);
    expect(screen.queryByRole("button", { name: "Escanear con cámara" })).not.toBeInTheDocument();
  });
});
