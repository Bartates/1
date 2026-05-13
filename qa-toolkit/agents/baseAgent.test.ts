import { StokAgent } from "@/agents/StokAgent";
import { describe, expect, it } from "vitest";

describe("BaseAgent permissions", () => {
  it("stok agent write iznine sahip olmalı", () => {
    const agent = new StokAgent();
    expect(agent.yetkiKontrolu("stok.write")).toBe(true);
    expect(agent.yetkiKontrolu("kasa.write")).toBe(false);
  });
});
