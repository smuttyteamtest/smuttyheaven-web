import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "./RegisterPage";

const { mockRegister } = vi.hoisted(() => ({ mockRegister: vi.fn() }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    booting: false,
    register: mockRegister,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <RegisterPage />
    </MemoryRouter>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, values: {
  username?: string;
  email?: string;
  password?: string;
  displayName?: string;
}) {
  if (values.username) await user.type(screen.getByLabelText("Username"), values.username);
  if (values.email) await user.type(screen.getByLabelText("Email"), values.email);
  if (values.password) await user.type(screen.getByLabelText("Password"), values.password);
  if (values.displayName)
    await user.type(screen.getByLabelText(/Display name/), values.displayName);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Sign up" }));

beforeEach(() => {
  mockRegister.mockReset();
});

describe("RegisterPage validation", () => {
  it("flags all empty required fields and never calls the API", async () => {
    const user = userEvent.setup();
    renderPage();

    await submit(user);

    expect(
      screen.getByText(/3–60 characters; letters, digits/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid email/)).toBeInTheDocument();
    expect(
      screen.getByText("Password must be 8–200 characters."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a too-short username", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, {
      username: "ab",
      email: "reader@example.com",
      password: "long-enough",
    });
    await submit(user);

    expect(
      screen.getByText(/3–60 characters; letters, digits/),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects usernames with characters outside the allowed set", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, {
      username: "bad!name",
      email: "reader@example.com",
      password: "long-enough",
    });
    await submit(user);

    expect(
      screen.getByText(/3–60 characters; letters, digits/),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, {
      username: "charli_reader",
      email: "not-an-email",
      password: "long-enough",
    });
    await submit(user);

    expect(screen.getByText(/Enter a valid email/)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters", async () => {
    const user = userEvent.setup();
    renderPage();

    await fill(user, {
      username: "charli_reader",
      email: "reader@example.com",
      password: "short",
    });
    await submit(user);

    expect(
      screen.getByText("Password must be 8–200 characters."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("submits trimmed values and omits an empty display name", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderPage();

    await fill(user, {
      username: "charli_reader",
      email: "reader@example.com",
      password: "long-enough",
    });
    await submit(user);

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith({
      username: "charli_reader",
      email: "reader@example.com",
      password: "long-enough",
    });
  });

  it("passes the display name through when provided", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    renderPage();

    await fill(user, {
      username: "charli_reader",
      email: "reader@example.com",
      password: "long-enough",
      displayName: "Charli",
    });
    await submit(user);

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith({
      username: "charli_reader",
      email: "reader@example.com",
      password: "long-enough",
      displayName: "Charli",
    });
  });

  it("surfaces the server's error message (e.g. duplicate account)", async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error("Username or email already taken"));
    renderPage();

    await fill(user, {
      username: "charli_reader",
      email: "reader@example.com",
      password: "long-enough",
    });
    await submit(user);

    expect(
      await screen.findByText("Username or email already taken"),
    ).toBeInTheDocument();
  });
});
