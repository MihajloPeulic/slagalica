"use client"

import { redirect } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { createGameRoom, joinGameRoomOnStart } from "@/actions/game";

export default function StartGame(){

    async function handleStartGame(){
    
          const {roomId} = await joinGameRoomOnStart()
          console.log(roomId)
    
          if(roomId){
            redirect(`/igra/${roomId}`)
          }
    
          const res = await createGameRoom()
    
          if(res?.error){
            alert(res.error)
          }
          
          console.log(res.roomId)
          redirect(`/igra/${res.roomId}`)
      }


    return(
        <button
          onClick={handleStartGame}
          className="cursor-pointer group relative w-full max-w-[280px] flex items-center justify-center gap-3 rounded-[2rem] bg-primary py-5 text-xl font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_50px_rgba(245,158,11,0.25)]"
        >
          <PlayCircle className="h-7 w-7 stroke-[2]" />
          Start a game
        </button>
    )
}