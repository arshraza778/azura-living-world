import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Character } from "../components/game/Game";
import { game, defaultData } from "../game/state/store";

beforeEach(()=> { vi.useFakeTimers(); localStorage.clear(); game.data=defaultData(); game.data.growth.unspent=3; });
afterEach(()=> { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });
it("shows six attributes and seven masteries, and plus/cancel/confirm operate on the real store", () => {
  render(<Character />);
  expect(screen.getAllByRole("button",{name:/^Add /})).toHaveLength(6);
  expect(screen.getAllByRole("progressbar")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button",{name:"Add Strength"}));
  expect(screen.getByRole("status").textContent).toContain("Pending: 1");
  expect(game.data.growth.attributes.strength).toBe(0);
  fireEvent.click(screen.getByRole("button",{name:"Cancel allocations"}));
  expect(game.data.growth.pending.strength).toBe(0);
  fireEvent.click(screen.getByRole("button",{name:"Add Vitality"}));
  fireEvent.click(screen.getByRole("button",{name:"Add Endurance"}));
  fireEvent.click(screen.getByRole("button",{name:"Add Intelligence"}));
  expect(screen.getByRole("button",{name:"Add Strength"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Confirm allocations"}));
  expect(game.data.growth.unspent).toBe(0);
  expect(game.data.growth.attributes.vitality).toBe(1);
  expect(game.data.maxHp).toBeGreaterThan(100);
  expect(game.data.maxStamina).toBeGreaterThan(100);
  expect(screen.getByRole("button",{name:"Confirm allocations"})).toBeDisabled();
});
