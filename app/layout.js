export const metadata = {
  title: 'AI SDLC Workshop',
  description: 'Minimal Next.js scaffold for local development',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Segoe UI, sans-serif', margin: 24 }}>{children}</body>
    </html>
  );
}
