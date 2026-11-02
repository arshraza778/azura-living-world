import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Azura — The Living Fantasy World" },
      { name: "description", content: "Explore Eldergrove, the Verdant Wilds and the dungeons of Azura in a playable fantasy world prototype." },
      { property: "og:title", content: "Azura — The Living Fantasy World" },
      { property: "og:description", content: "A playable 2D fantasy exploration prototype." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ClientOnly fallback={<div className="flex h-screen items-center justify-center bg-ink font-display text-2xl text-gold">Azura awakens…</div>}>
      <Game />
    </ClientOnly>
  ),
});
