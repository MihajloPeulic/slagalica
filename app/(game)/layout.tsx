import "@/app/globals.css";
import { OnlinePresenceProvider } from "@/components/OnlineUserContext";
import GameInviteListener from "@/components/GameInviteListener";
import { getCurrentUserWithProfile } from "@/data/auth";
import { redirect } from "next/navigation";


export default async function RootLayout({ children }: LayoutProps<"/">) {
  const data = await getCurrentUserWithProfile()

  if(data?.error){
    redirect("/login?error=unauthorized")
  }
  
  const {profile} = data
  
  return (
      <body className="min-h-full flex flex-col">
        <OnlinePresenceProvider>
          <div className="phone-frame">
            <GameInviteListener currentUserId={profile.id}  />

            {children}
          </div>
        </OnlinePresenceProvider>
      </body>
  );
}
