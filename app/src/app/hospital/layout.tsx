import Navbar from "@/components/navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main>
      <Navbar />
      <div className="grid grid-cols-12 min-w-[1400px] max-w-[1400px] mx-auto">
        <div className="col-span-3"></div>
        <div className="col-span-6">{children}</div>
        <div className="col-span-3"></div>
      </div>
    </main>
  );
}
