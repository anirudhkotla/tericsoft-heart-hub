import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: () => <Navigate to="/recruitment" replace />,
});
