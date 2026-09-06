import "@/app/globals.css";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  
  
  return (
          <div className="phone-frame">
            {children}
          </div>
  );
}
