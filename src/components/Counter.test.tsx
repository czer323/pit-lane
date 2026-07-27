import { describe, expect, it } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import Counter from "./Counter";

describe("Counter", () => {
  it("renders with initial count of 0", () => {
    render(() => <Counter />);
    expect(screen.getByText("Clicks: 0")).toBeInTheDocument();
  });

  it("increments count on click", async () => {
    const u = userEvent.setup();
    render(() => <Counter />);
    await u.click(screen.getByRole("button"));
    expect(screen.getByText("Clicks: 1")).toBeInTheDocument();
  });
});
