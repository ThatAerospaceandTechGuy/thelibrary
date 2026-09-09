import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Stacks — shared textbook shelf" },
      {
        name: "description",
        content:
          "The Stacks is a simple shared shelf for course textbooks: browse the list and download the PDF you need.",
      },
      { property: "og:title", content: "The Stacks — shared textbook shelf" },
      {
        property: "og:description",
        content: "Browse and download shared course textbooks in one clean list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// The real site is plain static HTML at the repo root (also copied into public/
// so the preview can serve it). Send the preview straight to it.
function Index() {
  useEffect(() => {
    window.location.replace("/index.html");
  }, []);
  return null;
}
