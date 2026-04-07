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

const ILAN_FIELDS = [
  { key: "konum", label: "Konum", icon: "📍" },
  { key: "bebekYasi", label: "Bebek/Çocuk Yaşı", icon: "👶" },
  { key: "gorevler", label: "Görevler", icon: "✅" },
  { key: "maas", label: "Maaş", icon: "💰" },
  { key: "ekBilgi", label: "Ek Bilgi", icon: "ℹ️" },
];

const DURUM_OPTIONS = ["İlk Görüşme", "Anlaşıldı", "Denemede", "Beklemede", "İptal"];

export default function Home() {
  const [tab, setTab] = useState<"musteri" | "ilan">("musteri");
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

  // İlan state
  const [ilanData, setIlanData] = useState<any>(null);
  const [ilanImageUrl, setIlanImageUrl] = useState<string | null>(null);
  const [ilanTranscription, setIlanTranscription] = useState("");
  const [ilanEditingField, setIlanEditingField] = useState<string | null>(null);

  // Post-save ilan flow
  const [showIlanPrompt, setShowIlanPrompt] = useState(false);
  const [savedTranscription, setSavedTranscription] = useState("");

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

  // ──────── API CALLS ────────
  const transcribeAudio = async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

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

  const parseIlanText = async (text: string) => {
    const res = await fetch("/api/parse-ilan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const generateIlanImage = async (data: any) => {
    const res = await fetch("/api/ilan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Görsel oluşturulamadı");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

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

  // ──────── MÜŞTERİ AKIŞI ────────
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
      // Transkripsiyon'u sakla, ilan için lazım olacak
      setSavedTranscription(transcription);
      setShowIlanPrompt(true);
      setScreen("ilan-prompt");
    } catch (err: any) {
      showToast(`Sheets hatası: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  // ──────── POST-SAVE İLAN AKIŞI ────────
  const generateIlanFromSaved = async () => {
    setIsProcessing(true);
    try {
      setProcessingStep("🤖 İlan bilgileri ayrıştırılıyor...");
      const parsed = await parseIlanText(savedTranscription);
      setIlanData(parsed);
      setProcessingStep("🎨 Görsel oluşturuluyor...");
      const url = await generateIlanImage(parsed);
      setIlanImageUrl(url);
      setScreen("ilan-review");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const skipIlan = () => {
    resetState();
    setSavedTranscription("");
    setShowIlanPrompt(false);
    setScreen("home");
  };

  // ──────── STANDALONE İLAN AKIŞI ────────
  const processIlanAudio = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    try {
      setProcessingStep("🎤 Ses yazıya çevriliyor...");
      const text = await transcribeAudio(audioBlob);
      setIlanTranscription(text);
      setProcessingStep("🤖 İlan bilgileri ayrıştırılıyor...");
      const parsed = await parseIlanText(text);
      setIlanData(parsed);
      setProcessingStep("🎨 Görsel oluşturuluyor...");
      const url = await generateIlanImage(parsed);
      setIlanImageUrl(url);
      setScreen("ilan-review");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const processIlanText = async () => {
    if (!ilanTranscription.trim()) return;
    setIsProcessing(true);
    try {
      setProcessingStep("🤖 İlan bilgileri ayrıştırılıyor...");
      const parsed = await parseIlanText(ilanTranscription);
      setIlanData(parsed);
      setProcessingStep("🎨 Görsel oluşturuluyor...");
      const url = await generateIlanImage(parsed);
      setIlanImageUrl(url);
      setScreen("ilan-review");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const regenerateIlan = async () => {
    if (!ilanData) return;
    setIsProcessing(true);
    setProcessingStep("🎨 Görsel yeniden oluşturuluyor...");
    try {
      const url = await generateIlanImage(ilanData);
      setIlanImageUrl(url);
      showToast("Görsel güncellendi! ✓");
    } catch (err: any) {
      showToast(`Hata: ${err.message}`, "error");
    }
    setIsProcessing(false);
    setProcessingStep("");
  };

  const downloadIlan = () => {
    if (!ilanImageUrl) return;
    const a = document.createElement("a");
    a.href = ilanImageUrl;
    a.download = `ilan_${Date.now()}.png`;
    a.click();
    showToast("İlan indirildi! ✓");
  };

  const shareIlan = async () => {
    if (!ilanImageUrl) return;
    try {
      const res = await fetch(ilanImageUrl);
      const blob = await res.blob();
      const file = new File([blob], "ilan.png", { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "İş İlanı" });
      } else {
        downloadIlan();
      }
    } catch {
      downloadIlan();
    }
  };

  const resetState = () => {
    setParsedData(null);
    setTranscription("");
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const resetIlanState = () => {
    setIlanData(null);
    setIlanImageUrl(null);
    setIlanTranscription("");
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const resetAll = () => {
    resetState();
    resetIlanState();
    setSavedTranscription("");
    setShowIlanPrompt(false);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ──────── STYLES ────────
  const th = {
    bg: "#FAF7F4", card: "#FFFFFF", primary: "#C17E4A", primaryLight: "#E8D5C0",
    primaryDark: "#8B5E34", text: "#2D2118", textLight: "#8C7A6B", accent: "#D4956A",
    danger: "#C75D3A", success: "#5A8F5C", border: "#E8E0D8", inputBg: "#F5F0EB",
  };

  const container: React.CSSProperties = {
    minHeight: "100vh", background: `linear-gradient(170deg, ${th.bg} 0%, #F0E8DF 100%)`,
    fontFamily: "'Nunito', sans-serif", color: th.text, maxWidth: 480, margin: "0 auto",
    position: "relative", paddingBottom: 72,
  };
  const headerS: React.CSSProperties = {
    padding: "20px 24px 16px", background: `linear-gradient(135deg, ${th.primary} 0%, ${th.primaryDark} 100%)`,
    color: "white", borderRadius: "0 0 24px 24px", boxShadow: "0 4px 20px rgba(193,126,74,0.3)",
  };
  const cardS: React.CSSProperties = {
    background: th.card, borderRadius: 16, padding: 20, margin: "12px 16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${th.border}`,
  };
  const btnP: React.CSSProperties = {
    background: `linear-gradient(135deg, ${th.primary} 0%, ${th.accent} 100%)`, color: "white",
    border: "none", borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 700,
    cursor: "pointer", width: "100%", boxShadow: "0 4px 14px rgba(193,126,74,0.35)", fontFamily: "inherit",
  };
  const btnS: React.CSSProperties = { ...btnP, background: th.inputBg, color: th.text, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" };
  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${th.border}`,
    background: th.inputBg, fontSize: 14, fontFamily: "inherit", color: th.text, outline: "none", boxSizing: "border-box",
  };

  // ──────── RECORD BUTTON ────────
  const renderRecordButton = () => (
    <div style={{ ...cardS, textAlign: "center", padding: 32 }}>
      <div onClick={isRecording ? stopRecording : startRecording} style={{
        width: 120, height: 120, borderRadius: "50%", margin: "0 auto 20px",
        background: isRecording
          ? `radial-gradient(circle, ${th.danger} 0%, #A04028 100%)`
          : `radial-gradient(circle, ${th.primary} 0%, ${th.primaryDark} 100%)`,
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
          <div style={{ fontSize: 32, fontWeight: 800, color: th.danger, fontVariantNumeric: "tabular-nums" }}>{formatTime(recordingTime)}</div>
          <div style={{ fontSize: 14, color: th.textLight }}>Kayıt devam ediyor...</div>
        </>
      ) : audioBlob ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: th.success }}>✓ Kayıt tamamlandı ({formatTime(recordingTime)})</div>
          <div style={{ fontSize: 13, color: th.textLight }}>İşleme gönderebilirsin</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Kayda Başla</div>
          <div style={{ fontSize: 13, color: th.textLight, marginTop: 4 }}>
            {tab === "musteri" ? "Müşteri bilgilerini sesle kaydet" : "İlan bilgilerini sesle kaydet"}
          </div>
        </>
      )}
    </div>
  );

  // ──────── MÜŞTERİ HOME ────────
  const renderMusteriHome = () => (
    <div>
      <div style={headerS}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Müşteri Kayıt</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Sesle kaydet → Sheets'e yaz</div>
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

      {renderRecordButton()}

      {audioBlob && (
        <div style={{ padding: "0 16px" }}>
          <button onClick={processAudio} disabled={isProcessing} style={{ ...btnP, opacity: isProcessing ? 0.6 : 1 }}>
            {isProcessing ? `⏳ ${processingStep}` : "🚀 Sesi İşle"}
          </button>
          <button onClick={() => { setAudioBlob(null); setRecordingTime(0); }} style={{ ...btnS, marginTop: 8 }}>🗑️ Kaydı Sil</button>
        </div>
      )}

      {!audioBlob && (
        <div style={cardS}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⌨️ Yazarak Gir</div>
          <textarea value={transcription} onChange={(e) => setTranscription(e.target.value)}
            placeholder="Esra Güler aradı, İstanbul'dan, Instagram'dan bulmuş. Bakıcı ve temizlik istiyor, bütçesi 33 bin..."
            style={{ ...input, minHeight: 100, resize: "vertical" }} />
          <button onClick={processText} disabled={!transcription.trim() || isProcessing}
            style={{ ...btnP, marginTop: 12, opacity: !transcription.trim() || isProcessing ? 0.5 : 1 }}>
            {isProcessing ? processingStep : "🤖 Analiz Et"}
          </button>
        </div>
      )}

      {savedRecords.length > 0 && (
        <div style={cardS}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Son Kayıtlar</div>
          {savedRecords.slice(0, 3).map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${th.border}` : "none" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.adSoyad || "İsimsiz"}</div>
                <div style={{ fontSize: 12, color: th.textLight }}>{r.sehir} · {r.talepTuru}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                background: r.durum === "Anlaşıldı" ? "#E8F5E8" : r.durum === "İptal" ? "#FDE8E8" : th.primaryLight,
                color: r.durum === "Anlaşıldı" ? th.success : r.durum === "İptal" ? th.danger : th.primaryDark,
              }}>{r.durum || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ──────── İLAN HOME (standalone) ────────
  const renderIlanHome = () => (
    <div>
      <div style={headerS}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>İlan Oluştur</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Sesle anlat → JPEG ilan oluştur</div>
        </div>
      </div>

      {renderRecordButton()}

      {audioBlob && (
        <div style={{ padding: "0 16px" }}>
          <button onClick={processIlanAudio} disabled={isProcessing} style={{ ...btnP, opacity: isProcessing ? 0.6 : 1 }}>
            {isProcessing ? `⏳ ${processingStep}` : "🚀 İlan Oluştur"}
          </button>
          <button onClick={() => { setAudioBlob(null); setRecordingTime(0); }} style={{ ...btnS, marginTop: 8 }}>🗑️ Kaydı Sil</button>
        </div>
      )}

      {!audioBlob && (
        <div style={cardS}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⌨️ Yazarak Gir</div>
          <textarea value={ilanTranscription} onChange={(e) => setIlanTranscription(e.target.value)}
            placeholder="Sapanca Sakarya'da, 9 aylık bebek bakımı, günde 15 dakika köpek gezdirme ve ev temizliği. 33.000TL + 300TL."
            style={{ ...input, minHeight: 100, resize: "vertical" }} />
          <button onClick={processIlanText} disabled={!ilanTranscription.trim() || isProcessing}
            style={{ ...btnP, marginTop: 12, opacity: !ilanTranscription.trim() || isProcessing ? 0.5 : 1 }}>
            {isProcessing ? processingStep : "🎨 İlan Oluştur"}
          </button>
        </div>
      )}
    </div>
  );

  // ──────── MÜŞTERİ REVIEW ────────
  const renderReview = () => (
    <div>
      <div style={headerS}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setScreen("home")} style={{ cursor: "pointer", fontSize: 20 }}>←</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Kayıt Önizleme</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Kontrol et, düzelt, kaydet</div>
          </div>
        </div>
      </div>
      {transcription && (
        <div style={{ ...cardS, background: th.inputBg }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: th.textLight, marginBottom: 6 }}>TRANSKRİPSİYON</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontStyle: "italic", color: th.textLight }}>"{transcription}"</div>
        </div>
      )}
      <div style={cardS}>
        {SHEET_COLUMNS.map((col) => {
          const value = parsedData?.[col.key] || "";
          const isEditing = editingField === col.key;
          return (
            <div key={col.key} style={{ padding: "12px 0", borderBottom: `1px solid ${th.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: th.textLight, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {col.icon} {col.label}
              </div>
              {isEditing ? (
                col.key === "durum" ? (
                  <select value={value} onChange={(e) => { setParsedData((p: any) => ({ ...p, [col.key]: e.target.value })); setEditingField(null); }} style={{ ...input }}>
                    <option value="">Seç...</option>
                    {DURUM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input autoFocus value={value}
                    onChange={(e) => setParsedData((p: any) => ({ ...p, [col.key]: e.target.value }))}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingField(null)}
                    style={input} />
                )
              ) : (
                <div onClick={() => col.editable !== false && setEditingField(col.key)} style={{
                  fontSize: 14, fontWeight: value ? 500 : 400,
                  color: value ? th.text : th.textLight, cursor: col.editable === false ? "default" : "pointer", padding: "4px 0",
                }}>{value || "Tıkla ve ekle..."}</div>
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

  // ──────── İLAN PROMPT (Post-save) ────────
  const renderIlanPrompt = () => (
    <div>
      <div style={headerS}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Kayıt Başarılı!</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Google Sheets'e eklendi</div>
          </div>
        </div>
      </div>

      <div style={{ ...cardS, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>İlan Görseli Oluştur?</div>
        <div style={{ fontSize: 14, color: th.textLight, lineHeight: 1.6 }}>
          Az önce kaydettiğin bilgilerden otomatik bir ilan görseli (JPEG) oluşturabilirim. Tekrar ses kaydı yapmana gerek yok!
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <button onClick={generateIlanFromSaved} disabled={isProcessing} style={{ ...btnP, opacity: isProcessing ? 0.6 : 1 }}>
          {isProcessing ? `⏳ ${processingStep}` : "🎨 Evet, İlan Oluştur"}
        </button>
        <button onClick={skipIlan} style={{ ...btnS, marginTop: 8 }}>
          Hayır, Ana Sayfaya Dön
        </button>
      </div>
    </div>
  );

  // ──────── İLAN REVIEW ────────
  const renderIlanReview = () => (
    <div>
      <div style={headerS}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => { resetIlanState(); resetAll(); setScreen("home"); }} style={{ cursor: "pointer", fontSize: 20 }}>←</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>İlan Önizleme</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Düzenle, yeniden oluştur, paylaş</div>
          </div>
        </div>
      </div>

      {ilanImageUrl && (
        <div style={{ ...cardS, padding: 12 }}>
          <img src={ilanImageUrl} alt="İlan" style={{ width: "100%", borderRadius: 12 }} />
        </div>
      )}

      <div style={cardS}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✏️ Bilgileri Düzenle</div>
        {ILAN_FIELDS.map((field) => {
          const value = ilanData?.[field.key] || "";
          const isEditing = ilanEditingField === field.key;
          return (
            <div key={field.key} style={{ padding: "10px 0", borderBottom: `1px solid ${th.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: th.textLight, marginBottom: 4, textTransform: "uppercase" }}>
                {field.icon} {field.label}
              </div>
              {isEditing ? (
                <input autoFocus value={value}
                  onChange={(e) => setIlanData((p: any) => ({ ...p, [field.key]: e.target.value }))}
                  onBlur={() => setIlanEditingField(null)}
                  onKeyDown={(e) => e.key === "Enter" && setIlanEditingField(null)}
                  style={input} />
              ) : (
                <div onClick={() => setIlanEditingField(field.key)} style={{
                  fontSize: 14, fontWeight: value ? 500 : 400,
                  color: value ? th.text : th.textLight, cursor: "pointer", padding: "4px 0",
                }}>{value || "Tıkla ve ekle..."}</div>
              )}
            </div>
          );
        })}
        <button onClick={regenerateIlan} disabled={isProcessing} style={{ ...btnS, marginTop: 12 }}>
          {isProcessing ? `⏳ ${processingStep}` : "🔄 Görseli Yenile"}
        </button>
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        <button onClick={shareIlan} style={btnP}>📤 Paylaş</button>
        <button onClick={downloadIlan} style={{ ...btnS, marginTop: 8 }}>💾 İndir</button>
        <button onClick={() => { resetAll(); setScreen("home"); }} style={{ ...btnS, marginTop: 8 }}>🏠 Ana Sayfa</button>
      </div>
    </div>
  );

  // ──────── HISTORY ────────
  const renderHistory = () => (
    <div>
      <div style={headerS}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={() => setScreen("home")} style={{ cursor: "pointer", fontSize: 20 }}>←</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Kayıt Geçmişi</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{savedRecords.length} kayıt</div>
          </div>
        </div>
      </div>
      {savedRecords.length === 0 ? (
        <div style={{ ...cardS, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Henüz kayıt yok</div>
        </div>
      ) : (
        savedRecords.map((r) => (
          <div key={r.id} style={cardS}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.adSoyad || "İsimsiz"}</div>
                <div style={{ fontSize: 13, color: th.textLight }}>📍 {r.sehir} · 📞 {r.telefon}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, height: "fit-content",
                background: r.durum === "Anlaşıldı" ? "#E8F5E8" : th.primaryLight,
                color: r.durum === "Anlaşıldı" ? th.success : th.primaryDark,
              }}>{r.durum}</div>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[r.talepTuru, r.butce && `💰 ${r.butce}`, r.kaynak && `📲 ${r.kaynak}`].filter(Boolean).map((tag, i) => (
                <span key={i} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: th.inputBg, color: th.textLight }}>{tag}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: th.textLight, marginTop: 8, textAlign: "right" }}>{r.tarih} · {r.musteriKodu}</div>
          </div>
        ))
      )}
    </div>
  );

  // ──────── TAB BAR ────────
  const renderTabBar = () => (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480, background: th.card, borderTop: `1px solid ${th.border}`,
      display: "flex", zIndex: 50, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
    }}>
      <div onClick={() => { setTab("musteri"); setScreen("home"); resetIlanState(); }} style={{
        flex: 1, padding: "12px 0", textAlign: "center", cursor: "pointer",
        color: tab === "musteri" ? th.primary : th.textLight,
        borderTop: tab === "musteri" ? `3px solid ${th.primary}` : "3px solid transparent",
      }}>
        <div style={{ fontSize: 20 }}>👥</div>
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>Müşteri Kayıt</div>
      </div>
      <div onClick={() => { setTab("ilan"); setScreen("home"); resetState(); }} style={{
        flex: 1, padding: "12px 0", textAlign: "center", cursor: "pointer",
        color: tab === "ilan" ? th.primary : th.textLight,
        borderTop: tab === "ilan" ? `3px solid ${th.primary}` : "3px solid transparent",
      }}>
        <div style={{ fontSize: 20 }}>📢</div>
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>İlan Oluştur</div>
      </div>
    </div>
  );

  return (
    <div style={container}>
      {screen === "home" && tab === "musteri" && renderMusteriHome()}
      {screen === "home" && tab === "ilan" && renderIlanHome()}
      {screen === "review" && renderReview()}
      {screen === "ilan-prompt" && renderIlanPrompt()}
      {screen === "ilan-review" && renderIlanReview()}
      {screen === "history" && renderHistory()}

      {(screen === "home" || screen === "history") && renderTabBar()}

      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? th.danger : toast.type === "info" ? th.primary : th.success,
          color: "white", padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 100, maxWidth: "90%", textAlign: "center",
        }}>{toast.msg}</div>
      )}

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        textarea:focus, input:focus, select:focus { border-color: ${th.primary} !important; box-shadow: 0 0 0 3px rgba(193,126,74,0.15) !important; }
      `}</style>
    </div>
  );
}
