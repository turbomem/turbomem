import type { ReactNode } from "react";

export const metadata = {
  title: "turbomem chatbot",
  description: "Example chatbot with turbomem and the Vercel AI SDK",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
