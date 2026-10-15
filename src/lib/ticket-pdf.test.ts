import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tickets", () => ({ ticketsService: { download: vi.fn() } }));

import { ticketsService } from "@/services/tickets";
import { downloadTicketPDF } from "./ticket-pdf";

describe("downloadTicketPDF", () => {
  beforeEach(() => {
    vi.mocked(ticketsService.download).mockResolvedValue(new Blob(["pdf"]));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:ticket");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("descarga el PDF con el nombre ticket-<folio>.pdf, lo clica, quita el enlace y libera la URL", async () => {
    const clicked: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
      expect(document.body.contains(this)).toBe(true);
    });

    await downloadTicketPDF(7, "T-0042");

    expect(ticketsService.download).toHaveBeenCalledWith(7);
    expect(click).toHaveBeenCalledTimes(1);
    const link = clicked[0];
    expect(link.download).toBe("ticket-T-0042.pdf");
    expect(link.href).toBe("blob:ticket");
    expect(document.body.contains(link)).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ticket");
  });

  it("crea el blob con tipo application/pdf", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await downloadTicketPDF(1, "X");
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
  });
});
