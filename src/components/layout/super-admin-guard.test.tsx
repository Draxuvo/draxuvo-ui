import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/es/usuarios" }));

import { SuperAdminGuard } from "./super-admin-guard";

const mount = (role: string | null) => {
  useAuthStore.setState({ role: role as never });
  renderWithProviders(
    <SuperAdminGuard>
      <p>Marco del super admin</p>
    </SuperAdminGuard>,
  );
};

beforeEach(() => replace.mockClear());

describe("SuperAdminGuard (spec 055, H-57)", () => {
  it("el super admin ve la pantalla", () => {
    mount("super_admin");
    expect(screen.getByText("Marco del super admin")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("un dueño o administrador no ve nada y vuelve a su inicio", () => {
    for (const role of ["owner", "admin"]) {
      replace.mockClear();
      mount(role);
      expect(screen.queryByText("Marco del super admin")).not.toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith("/es/inicio");
    }
  });

  it("el personal vuelve a sus órdenes", () => {
    mount("staff");
    expect(screen.queryByText("Marco del super admin")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/es/mis-ordenes");
  });

  it("sin rol (hidratando) no pinta ni redirige", () => {
    mount(null);
    expect(screen.queryByText("Marco del super admin")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
