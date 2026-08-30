import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function getCurrentUserWithProfile(){
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: "Niste ulogovani." };
    }

    // 2. Sada pomoću user.id dohvatamo njegov profil iz 'profiles' tabele
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(); // Koristimo .single() jer očekujemo tačno jedan red (profil) za tog usera

    if (profileError) {
        console.log("Greška pri dohvatanju profila:", profileError.message);
        return { error: "Profil nije pronađen." };
    }

    return { user, profile };

}