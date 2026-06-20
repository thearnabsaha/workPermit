import type { Metadata } from "next";
import "./globals.css";
import { TASK_CONFIG } from "@/lib/taskConfig";

export const metadata: Metadata = {
  title: TASK_CONFIG.projectName,
  description: TASK_CONFIG.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
