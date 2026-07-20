import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountManagePanel from "./AccountManagePanel";
import type { PublicUser } from "../api/types";

const { mockUpdateProfile, mockChangePassword, mockLogout, mockDeleteAccount, mockToast } =
  vi.hoisted(() => ({
    mockUpdateProfile: vi.fn(),
    mockChangePassword: vi.fn(),
    mockLogout: vi.fn(),
    mockDeleteAccount: vi.fn(),
    mockToast: vi.fn(),
  }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    updateProfile: mockUpdateProfile,
    changePassword: mockChangePassword,
    logout: mockLogout,
  }),
}));
vi.mock("./Toasts", () => ({ useToast: () => mockToast }));
vi.mock("../api/endpoints", () => ({ deleteAccount: mockDeleteAccount }));

const USER: PublicUser = {
  id: 1,
  username: "charli_reader",
  email: "charli@example.com",
  displayName: "Charli",
  role: "reader",
  registered: "2026-01-01T00:00:00.000Z",
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <AccountManagePanel user={USER} />
    </MemoryRouter>,
  );
}

const setup = () => userEvent.setup();

beforeEach(() => {
  mockUpdateProfile.mockReset().mockResolvedValue(undefined);
  mockChangePassword.mockReset().mockResolvedValue(undefined);
  mockDeleteAccount.mockReset().mockResolvedValue(undefined);
  mockLogout.mockReset();
  mockToast.mockReset();
});

describe("AccountManagePanel — profile", () => {
  it("sends only the changed field and no password when just the name changes", async () => {
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    // The current-password field only exists once the email diverges.
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();

    const name = screen.getByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "Charli Two");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: "Charli Two" });
  });

  it("requires the current password to change email and passes it through", async () => {
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const email = screen.getByLabelText("Email");
    await user.clear(email);
    await user.type(email, "new@example.com");

    // Typing a new email reveals the re-auth field; submitting empty is blocked.
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      screen.getByText(/current password to change your email/i),
    ).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Current password"), "secret-pass-1!");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      email: "new@example.com",
      currentPassword: "secret-pass-1!",
    });
  });

  it("blocks a no-op save", async () => {
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Nothing changed.")).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});

describe("AccountManagePanel — password", () => {
  it("rejects a mismatched confirmation without calling the API", async () => {
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.type(screen.getByLabelText("Current password"), "old-pass-1!");
    await user.type(screen.getByLabelText("New password"), "new-pass-2!");
    await user.type(screen.getByLabelText("Confirm new password"), "different!");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(screen.getByText("New passwords don't match.")).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("submits a valid password change", async () => {
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.type(screen.getByLabelText("Current password"), "old-pass-1!");
    await user.type(screen.getByLabelText("New password"), "new-pass-2!");
    await user.type(screen.getByLabelText("Confirm new password"), "new-pass-2!");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: "old-pass-1!",
      newPassword: "new-pass-2!",
    });
  });
});

describe("AccountManagePanel — delete", () => {
  it("keeps the button disabled until the username matches, then deletes and logs out", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const submit = screen.getByRole("button", { name: "Delete my account" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Current password"), "secret-pass-1!");
    await user.type(
      screen.getByLabelText(/type your username/i),
      "charli_reader",
    );
    expect(submit).toBeEnabled();

    await user.click(submit);

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith("secret-pass-1!"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("does not delete when the confirmation dialog is dismissed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.type(screen.getByLabelText("Current password"), "secret-pass-1!");
    await user.type(screen.getByLabelText(/type your username/i), "charli_reader");
    await user.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
