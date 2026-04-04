"use client";

import { useState, useRef, useEffect } from "react";

const SHEET_COLUMNS = [
  { key: "musteriKodu", label: "Müşteri Kodu", icon: "🏷️", editable: false },
  { key: "adSoyad", label: "Ad Soyad", icon: "👤" },
  { key: "telefon", label: "Telefon", icon: "📞" },
  { key: "sehir", label: "Şehir", icon: "📍" },
  { key: "kaynak", label: "Kaynak", icon: "📲" },
  { key: "talepTuru", label: "Talep Türü", icon: "📋" },
  { key: "butce", label: "Bütçe", icon: "💰" },
  { key: "durum", label: "Durum", icon: "📌" },
  { key: "sonGorusme", label: "Son Görüşme", icon: "💬" },
  { key: "sonrakiAksiyon", label: "Sonraki Aksiyon", icon: "➡️" },
  { key: "notlar", label: "Notlar", icon: "📝" },
];

const DURUM_OPTIONS = ["İlk Görüşme", "Anlaşıldı", "Denemede", "Beklemede", "İptal"];

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [pulseAnim, setPulseAnim] = useState(0);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const animRef = useRef<any>(null);

  useEffect(() => {
    if (isRecording) {
      const animate = () => {
        setPulseAnim((prev) => prev + 0.05);
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [isRecording]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ──────── SES KAYDI ────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      showToast("Mikrofon erişimi reddedildi", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // ──────── SES → METİN (Whisper) ────────
  const transcribeAudio = async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

  // ──────── METİN → JSON (Claude) ────────
  const parseText = async (text: string) => {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  // ──────── JSON → SHEETS ────────
  const saveToSheets = async (data: any) => {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    return result;
  };

  // ──────── ANA İŞLEM AKIŞI ────────
  const processAudio = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    try {
      setProcessingStep("🎤 Ses yazıya çevriliyor...");
      const text = await transcribeAudio(audioBlob);
      setTranscription(text);

      setProcessingStep("🤖 Bilgiler ayrıştırılıyor...");
      const parsed = await parseText(text);
      setParsedData(parsed);
      setScreen("review");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const processText = async () => {
    if (!transcription.trim()) return;
    setIsProcessing(true);
    try {
      setProcessingStep("🤖 Bilgiler ayrıştırılıyor...");
      const parsed = await parseText(transcription);
      setParsedData(parsed);
      setScreen("review");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const saveRecord = async () => {
    setIsProcessing(true);
    setProcessingStep("📊 Google Sheets'e kaydediliyor...");
    try {
      await saveToSheets(parsedData);
      const record = { ...parsedData, tarih: new Date().toLocaleDateString("tr-TR"), id: Date.now() };
      setSavedRecords((prev) => [record, ...prev]);
      showToast("Google Sheets'e kaydedildi! ✓");
      resetState();
      setScreen("home");
    } catch (err: any) {
      showToast(`Sheets hatası: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const resetState = () => {
    setParsedData(null);
    setTranscription("");
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ──────── STYLES ────────
  const t = {
    bg: "#FAF7F4", card: "#FFFFFF", primary: "#C17E4A", primaryLight: "#E8D5C0",
    primaryDark: "#8B5E34", text: "#2D2118", textLight: "#8C7A6B", accent: "#D4956A",
    danger: "#C75D3A", success: "#5A8F5C", border: "#E8E0D8", inputBg: "#F5F0EB",
  };

  const container: React.CSSProperties = {
    minHeight: "100vh", background: `linear-gradient(170deg, ${t.bg} 0%, #F0E8DF 100%)`,
    fontFamily: "'Nunito', sans-serif", color: t.text, maxWidth: 480, margin: "0 auto", position: "relative",
  };
  const header: React.CSSProperties = {
    padding: "20px 24px 16px", background: `linear-gradient(135deg, ${t.primary} 0%, ${t.primaryDark} 100%)`,
    color: "white", borderRadius: "0 0 24px 24px", boxShadow: "0 4px 20px rgba(193,126,74,0.3)",
  };
  const card: React.CSSProperties = {
    background: t.card, borderRadius: 16, padding: 20, margin: "12px 16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${t.border}`,
  };
  const btnP: React.CSSProperties = {
    background: `linear-gradient(135deg, ${t.primary} 0%, ${t.accent} 100%)`, color: "white",
    border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700,
    cursor: "pointer", width: "100%", boxShadow: "0 4px 14px rgba(193,126,74,0.35)", fontFamily: "inherit",
  };
  const btnS: React.CSSProperties = { ...btnP, background: t.inputBg, color: t.text, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" };
  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${t.border}`,
    background: t.inputBg, fontSize: 14, fontFamily: "inherit", color: t.text, outline: "none", boxSizing: "border-box",
  };

  // ──────── HOME SCREEN ────────
  const renderHome = () => (
    <div>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Sesli Kayıt</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Müşteri Takip Sistemi</div>
          </div>
          <div onClick={() => setScreen("history")} style={{
            width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer",
          }}>📋</div>
        </div>
        {savedRecords.length > 0 && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>Bugün: {savedRecords.filter((r) => r.tarih === new Date().toLocaleDateString("tr-TR")).length}</span>
            <span>Toplam: {savedRecords.length}</span>
          </div>
        )}
      </div>

      {/* Kayıt Butonu */}
      <div style={{ ...card, textAlign: "center", padding: 32 }}>
        <div onClick={isRecording ? stopRecording : startRecording} style={{
          width: 120, height: 120, borderRadius: "50%", margin: "0 auto 20px",
          background: isRecording
            ? `radial-gradient(circle, ${t.danger} 0%, #A04028 100%)`
            : `radial-gradient(circle, ${t.primary} 0%, ${t.primaryDark} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: isRecording
            ? `0 0 0 ${12 + Math.sin(pulseAnim) * 8}px rgba(199,93,58,0.15)`
            : "0 6px 24px rgba(193,126,74,0.35)",
        }}>
          {isRecording ? (
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "white" }} />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {isRecording ? (
          <>
            <div style={{ fontSize: 32, fontWeight: 800, color: t.danger, fontVariantNumeric: "tabular-nums" }}>{formatTime(recordingTime)}</div>
            <div style={{ fontSize: 14, color: t.textLight }}>Kayıt devam ediyor...</div>
          </>
        ) : audioBlob ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.success }}>✓ Kayıt tamamlandı ({formatTime(recordingTime)})</div>
            <div style={{ fontSize: 13, color: t.textLight }}>İşleme gönderebilirsin</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Kayda Başla</div>
            <div style={{ fontSize: 13, color: t.textLight, marginTop: 4 }}>Müşteriyle görüştükten sonra bilgileri sesle kaydet</div>
          </>
        )}
      </div>

      {/* Ses İşleme Butonu */}
      {audioBlob && (
        <div style={{ padding: "0 16px" }}>
          <button onClick={processAudio} disabled={isProcessing} style={{ ...btnP, opacity: isProcessing ? 0.6 : 1 }}>
            {isProcessing ? `⏳ ${processingStep}` : "🚀 Sesi İşle"}
          </button>
          <button onClick={() => { setAudioBlob(null); setRecordingTime(0); }} style={{ ...btnS, marginTop: 8 }}>
            🗑️ Kaydı Sil
          </button>
        </div>
      )}

      {/* Yazarak Giriş */}
      {!audioBlob && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⌨️ Yazarak Gir</div>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Esra Güler aradı, İstanbul'dan, Instagram'dan bulmuş. Bakıcı ve temizlik istiyor, bütçesi 33 bin..."
            style={{ ...input, minHeight: 100, resize: "vertical" }}
          />
          <button onClick={processText} disabled={!transcription.trim() || isProcessing} style={{ ...btnP, marginTop: 12, opacity: !transcription.trim() || isProcessing ? 0.5 : 1 }}>
            {isProcessing ? processingStep : "🤖 Analiz Et"}
          </button>
        </div>
      )}

      {/* Son Kayıtlar */}
      {savedRecords.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Son Kayıtlar</div>
          {savedRecords.slice(0, 3).map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${t.border}` : "none" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.adSoyad || "İsimsiz"}</div>
                <div style={{ fontSize: 12, color: t.textLight }}>{r.sehir} · {r.talepTuru}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                background: r.durum === "Anlaşıldı" ? "#E8F5E8" : r.durum === "İptal" ? "#FDE8E8" : t.primaryLight,
                color: r.durum === "Anlaşıldı" ? t.success : r.durum === "İptal" ? t.danger : t.primaryDark,
              }}>{r.durum || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ──────── REVIEW SCREEN ────────
  const renderReview = () => (
    <div>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setScreen("home")} style={{ cursor: "pointer", fontSize: 20 }}>←</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Kayıt Önizleme</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Kontrol et, düzelt, kaydet</div>
          </div>
        </div>
      </div>

      {transcription && (
        <div style={{ ...card, background: t.inputBg }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textLight, marginBottom: 6 }}>TRANSKRİPSİYON</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontStyle: "italic", color: t.textLight }}>"{transcription}"</div>
        </div>
      )}

      <div style={card}>
        {SHEET_COLUMNS.map((col) => {
          const value = parsedData?.[col.key] || "";
          const isEditing = editingField === col.key;
          return (
            <div key={col.key} style={{ padding: "12px 0", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textLight, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {col.icon} {col.label}
              </div>
              {isEditing ? (
                col.key === "durum" ? (
                  <select value={value} onChange={(e) => { setParsedData((p: any) => ({ ...p, [col.key]: e.target.value })); setEditingField(null); }} style={{ ...input, flex: 1 }}>
                    <option value="">Seç...</option>
                    {DURUM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input autoFocus value={value}
                    onChange={(e) => setParsedData((p: any) => ({ ...p, [col.key]: e.target.value }))}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                    style={input}
                  />
                )
              ) : (
                <div onClick={() => col.editable !== false && setEditingField(col.key)} style={{
                  fontSize: 14, fontWeight: value ? 500 : 400,
                  color: value ? t.text : t.textLight, cursor: col.editable === false ? "default" : "pointer", padding: "4px 0",
                }}>
                  {value || "Tıkla ve ekle..."}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        <button onClick={saveRecord} disabled={isProcessing} style={{ ...btnP, opacity: isProcessing ? 0.6 : 1 }}>
          {isProcessing ? `⏳ ${processingStep}` : "✅ Google Sheets'e Kaydet"}
        </button>
        <button onClick={() => { resetState(); setScreen("home"); }} style={{ ...btnS, marginTop: 8 }}>İptal</button>
      </div>
    </div>
  );

  // ──────── HISTORY SCREEN ────────
  const renderHistory = () => (
    <div>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setScreen("home")} style={{ cursor: "pointer", fontSize: 20 }}>←</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Kayıt Geçmişi</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{savedRecords.length} kayıt</div>
          </div>
        </div>
      </div>
      {savedRecords.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Henüz kayıt yok</div>
          <div style={{ fontSize: 13, color: t.textLight }}>İlk ses kaydını yaparak başla</div>
        </div>
      ) : (
        savedRecords.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.adSoyad || "İsimsiz"}</div>
                <div style={{ fontSize: 13, color: t.textLight }}>📍 {r.sehir} · 📞 {r.telefon}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, height: "fit-content",
                background: r.durum === "Anlaşıldı" ? "#E8F5E8" : t.primaryLight,
                color: r.durum === "Anlaşıldı" ? t.success : t.primaryDark,
              }}>{r.durum}</div>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[r.talepTuru, r.butce && `💰 ${r.butce}`, r.kaynak && `📲 ${r.kaynak}`].filter(Boolean).map((tag, i) => (
                <span key={i} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: t.inputBg, color: t.textLight }}>{tag}</span>
              ))}
            </div>
            {r.notlar && <div style={{ fontSize: 13, color: t.textLight, marginTop: 8, fontStyle: "italic" }}>{r.notlar}</div>}
            <div style={{ fontSize: 11, color: t.textLight, marginTop: 8, textAlign: "right" }}>{r.tarih} · {r.musteriKodu}</div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={container}>
      {screen === "home" && renderHome()}
      {screen === "review" && renderReview()}
      {screen === "history" && renderHistory()}

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? t.danger : toast.type === "info" ? t.primary : t.success,
          color: "white", padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 100, maxWidth: "90%", textAlign: "center",
        }}>{toast.msg}</div>
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        textarea:focus, input:focus, select:focus { border-color: ${t.primary} !important; box-shadow: 0 0 0 3px rgba(193,126,74,0.15) !important; }
      `}</style>
    </div>
  );
}
