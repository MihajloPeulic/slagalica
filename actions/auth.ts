"use server"

import { createServerSupabaseClient } from "@/utils/supabase/server"
import { error } from "console";
import { redirect } from "next/navigation";


export async function RegisterAction(formData: FormData) {
    
    const  supabase = await createServerSupabaseClient();

    const email = String(formData.get("email"))
    const password = String(formData.get("password"))
    const confirm_password = String(formData.get("confirm_password"))
    const username = String(formData.get("username"))
    
    const USERNAME_REGEX = /^[a-z0-9]+$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PASSWORD_REGEX = /^(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;


    if(!EMAIL_REGEX.test(email)){
        return {error: "Ovo nije pravi email."}
    }

    if(username.length > 16 || username.length < 3){
        return {error: "Username mora imati izmedju 3 i 16 karaktera."}
    }

    if(!USERNAME_REGEX.test(username)){
        return {error: "Username smije imati samo slova i brojeve."}
    }

    if (!PASSWORD_REGEX.test(password)) {
      return {error: "Lozinka mora imati najmanje 8 karaktera, bar jedno veliko slovo, bar jedan broj i bar jedan specijalni znak."}
    }

    if(password !== confirm_password){
        return {error: "Lozinke se ne poklapaju."}
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username, // Prosleđujemo username kroz metadata
            },
        },
    });

    if (authError) {
        return { error: authError.message };
    }

    redirect("/")

}

export async function LoginAction(formData: FormData) {
    
    const  supabase = await createServerSupabaseClient();

    const email = String(formData.get("email"))
    const password = String(formData.get("password"))
    
    const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (authError) {
        return { error: authError.message };
    }

     redirect("/")

}

export async function LogOutAction() {
    
    const  supabase = await createServerSupabaseClient();

    
    const { error: authError } = await supabase.auth.signOut();

    if (authError) {
        return { error: authError.message };
    }

    redirect("/login")

}
