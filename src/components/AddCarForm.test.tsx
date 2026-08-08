import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";

// Mock the server function
vi.mock("~/server/api/cars", () => ({
  createCar: vi.fn(async () => ({
    carId: 1,
    name: "Lightning",
    body: "S10",
    chassis: "wire",
    weightG: 85,
    motor: "FK-180SH",
    atTrack: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  })),
  setAtTrack: vi.fn(),
}));

// Mock router
vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

import AddCarForm from "./AddCarForm";

const setup = () => render(() => <AddCarForm />);

describe("AddCarForm", () => {
  it("renders all form inputs", () => {
    setup();
    expect(screen.getByLabelText("Car Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
    expect(screen.getByLabelText("Motor")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight (g)")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    setup();
    expect(screen.getByRole("button", { name: /add car/i })).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("shows validation error when name is whitespace", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "   ");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });
});
