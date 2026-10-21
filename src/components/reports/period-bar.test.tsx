import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { urlStore } from "@/test/report-fixtures";
import { useReportPeriod } from "@/hooks/use-report-period";
import { PeriodBar } from "./period-bar";

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await vi.importActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ replace: (url: string) => urlStore.set(url.split("?")[1] ?? "") }),
    usePathname: () => "/es/reportes",
    useSearchParams: () => {
      useSyncExternalStore(urlStore.subscribe, urlStore.get, urlStore.get);
      return new URLSearchParams(urlStore.get());
    },
  };
});

function Bar({ showCompare = true }: { showCompare?: boolean }) {
  const period = useReportPeriod();
  return (
    <>
      <PeriodBar period={period} showCompare={showCompare} />
      <output data-testid="range">{`${period.range.from}|${period.range.to}`}</output>
    </>
  );
}

beforeEach(() => {
  urlStore.set("");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 20, 0)); // 20:00 local: en UTC ya es el 22
});

describe("PeriodBar", () => {
  it("por defecto muestra este mes con la fecha local y lo dice en texto", () => {
    renderWithProviders(<Bar />);
    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-01|2026-10-21");
    expect(screen.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Viendo 01 oct 2026 – 21 oct 2026/)).toBeInTheDocument();
  });

  it("un atajo cambia el rango y queda en la URL", () => {
    renderWithProviders(<Bar />);
    act(() => screen.getByRole("button", { name: "Mes pasado" }).click());
    expect(screen.getByTestId("range")).toHaveTextContent("2026-09-01|2026-09-30");
    expect(urlStore.get()).toBe("rango=mes-anterior");
  });

  it("al recargar con el rango en la URL se conserva", () => {
    urlStore.set("rango=7d");
    renderWithProviders(<Bar />);
    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-15|2026-10-21");
  });

  it("'Hasta' anterior a 'Desde' avisa junto al campo y conserva el último rango válido", () => {
    renderWithProviders(<Bar />);
    act(() => screen.getByRole("button", { name: "Personalizado" }).click());
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-12" } });
    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-10|2026-10-12");

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-05" } });
    expect(screen.getByRole("alert")).toHaveTextContent("«Hasta» no puede ser anterior a «Desde».");
    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-10|2026-10-12");
  });

  it("el interruptor de comparar solo aparece donde se pide y escribe en la URL", () => {
    const { unmount } = renderWithProviders(<Bar showCompare={false} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<Bar />);
    act(() => screen.getByRole("switch", { name: "Comparar con el periodo anterior" }).click());
    expect(urlStore.get()).toBe("comparar=1");
    expect(screen.getByText(/Periodo anterior: 10 sep 2026 – 30 sep 2026/)).toBeInTheDocument();
  });
});
