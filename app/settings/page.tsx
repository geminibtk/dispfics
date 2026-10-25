"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import AppShell from "../components/AppShell";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [club, setClub] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      try {
        const s = createClient();
        const { data, error: authError } = await s.auth.getUser();
        if (!active) return;
        if (!data.user) {
          if (authError && !authError.message.toLowerCase().includes("session missing")) {
            setError("Oturum doğrulanamadı. Yeniden giriş yapabilirsiniz.");
          }
          return;
        }
        setSignedIn(true);
        setEmail(data.user.email || "");
        const { data: membership } = await s.from("club_members")
          .select("club_id").eq("user_id", data.user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (membership && active) {
          const { data: selectedClub } = await s.from("clubs")
            .select("name").eq("id", membership.club_id).maybeSingle();
          if (active) setClub(selectedClub?.name || "");
        }
      } catch {
        if (active) setError("Hesap bilgileri yüklenemedi.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccount();
    return () => { active = false; };
  }, []);

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Çıkış yapılamadı. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Ayarlar">
      <div style={{ maxWidth: 680, display: "grid", gap: 20 }}>
        {loading ? <p>Ayarlar yükleniyor…</p> : (
          <>
            <section className="clubSquadPanel" style={{ padding: 24 }}>
              <h2>Hesap Bilgileri</h2>
              <p style={{ color: "#8fa399" }}>
                {signedIn ? "Oturum açtığınız hesabın bilgileri" : "Bu cihazda açık bir oturum bulunmuyor."}
              </p>
              <p><strong>E-posta:</strong> {email || "—"}</p>
              <p><strong>Kulüp:</strong> {club || "Henüz seçilmedi"}</p>
            </section>
            <section className="clubSquadPanel" style={{ padding: 24 }}>
              <h2>Oturum</h2>
              <p style={{ color: "#8fa399" }}>
                {signedIn ? "Bu cihazdaki oturumunuzu kapatabilirsiniz." : "Hesabınıza giriş yapabilirsiniz."}
              </p>
              {signedIn ? (
                <button type="button" className="playerBack" onClick={signOut} disabled={busy}>
                  {busy ? "Çıkış yapılıyor…" : "Çıkış Yap"}
                </button>
              ) : (
                <button type="button" className="playerBack" onClick={() => router.push("/login")}>
                  Giriş Yap
                </button>
              )}
            </section>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
