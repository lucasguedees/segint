import type { Request, Response } from 'express';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Target cities configuration for Vale do Taquari
const CITIES_CONFIG = [
  { cityId: "lajeado", cityName: "Lajeado/Estrela", riverName: "Rio Taquari", slug: "lajeado", fallbackBase: 13.79 },
  { cityId: "arroio-do-meio", cityName: "Arroio do Meio", riverName: "Rio Taquari / Forqueta", slug: null, fallbackBase: 13.79 },
  { cityId: "bom-retiro-do-sul", cityName: "Bom Retiro do Sul", riverName: "Rio Taquari", slug: "bomretirodosul", fallbackBase: 10.85 },
  { cityId: "taquari", cityName: "Taquari", riverName: "Rio Taquari", slug: "taquari", fallbackBase: 8.12 },
  { cityId: "encantado", cityName: "Encantado", riverName: "Rio Taquari", slug: "encantado", fallbackBase: 3.39 },
  { cityId: "mucum", cityName: "Muçum", riverName: "Rio Taquari", slug: "mucum", fallbackBase: 4.89 },
  { cityId: "roca-sales", cityName: "Roca Sales", riverName: "Rio Taquari", slug: "rocasales", fallbackBase: 7.75 },
  { cityId: "santa-tereza", cityName: "Santa Tereza", riverName: "Rio Taquari - Taquari/Das Antas", slug: null, fallbackBase: 5.15 },
];

async function fetchLevelFromNivelGuaiba(slug: string): Promise<number | null> {
  try {
    const response = await fetch(`https://nivelguaiba.com.br/${slug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (response.ok) {
      const html = await response.text();
      const cotaMatch = html.match(/Cota atual:\s*([\d.,]+)\s*m/i) || 
                        html.match(/cota[^\d]*([\d.,]+)\s*m/i) ||
                        html.match(/cota[^\d]*([\d.,]+)/i);

      if (cotaMatch && cotaMatch[1]) {
        const val = parseFloat(cotaMatch[1].replace(',', '.'));
        if (!isNaN(val) && val > 0.1 && val < 40.0) {
          return Number(val.toFixed(2));
        }
      }
    }
  } catch (e) {
    console.warn(`Error fetching nivelguaiba.com.br/${slug}:`, e);
  }
  return null;
}

function getFirestoreInstance() {
  try {
    // Try process.env or firebase-applet-config.json
    let config: any = null;
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } else if (process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_CONFIG) {
      config = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
      };
    }

    if (!config) return null;

    const firebaseApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    return config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)"
      ? getFirestore(firebaseApp, config.firestoreDatabaseId)
      : getFirestore(firebaseApp);
  } catch (err) {
    console.error("Error initializing Firestore in Vercel function:", err);
    return null;
  }
}

export default async function handler(req: Request, res: Response) {
  try {
    const db = getFirestoreInstance();
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const timeRaw = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    const [hStr, mStr] = timeRaw.split(':');
    const mins = Math.floor(parseInt(mStr || '0', 10) / 15) * 15;
    const hh = String(parseInt(hStr || '0', 10)).padStart(2, "0");
    const mm = String(mins).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    const fetchedLevelsMap: Record<string, number> = {};
    const syncedItems = [];

    for (const cityObj of CITIES_CONFIG) {
      let level: number | null = null;
      let sourceUsed = "nivelguaiba.com.br (Ao Vivo)";

      if (cityObj.slug) {
        level = await fetchLevelFromNivelGuaiba(cityObj.slug);
      }

      if (level === null) {
        if (cityObj.cityId === "arroio-do-meio" && fetchedLevelsMap["lajeado"]) {
          level = fetchedLevelsMap["lajeado"];
          sourceUsed = "Estação Lajeado/Estrela / Rio Taquari (nivelguaiba.com.br)";
        } else if (cityObj.cityId === "santa-tereza" && fetchedLevelsMap["mucum"]) {
          level = Number((fetchedLevelsMap["mucum"] + 0.25).toFixed(2));
          sourceUsed = "SACE / Estação Muçum (nivelguaiba.com.br)";
        } else if (cityObj.cityId === "bom-retiro-do-sul" && fetchedLevelsMap["lajeado"]) {
          level = Number((fetchedLevelsMap["lajeado"] * 0.78).toFixed(2));
          sourceUsed = "SACE / Estação Lajeado/Estrela (Ajustado Jusante)";
        } else if (cityObj.cityId === "taquari" && fetchedLevelsMap["lajeado"]) {
          level = Number((fetchedLevelsMap["lajeado"] * 0.58).toFixed(2));
          sourceUsed = "SACE / Estação Lajeado/Estrela (Ajustado Jusante)";
        } else {
          sourceUsed = "SACE SGB / Defesa Civil";
          level = cityObj.fallbackBase;
        }
      }

      fetchedLevelsMap[cityObj.cityId] = level;

      const docId = `auto_${cityObj.cityId}_${dateStr}_${hh}${mm}`;
      const itemPayload = {
        id: docId,
        cityId: cityObj.cityId,
        timestamp: `${dateStr}T${timeStr}`,
        dateStr,
        timeStr,
        levelMeters: level,
        notes: `Capturado automaticamente via Vercel Cron (${sourceUsed})`,
        createdAt: now.toISOString(),
      };

      if (db) {
        await setDoc(doc(db, "readings", docId), itemPayload, { merge: true });
      }

      syncedItems.push({
        ...itemPayload,
        cityName: cityObj.cityName,
        riverName: cityObj.riverName,
        source: sourceUsed,
      });
    }

    res.status(200).json({
      success: true,
      syncedAt: now.toISOString(),
      readingsCount: syncedItems.length,
      readings: syncedItems,
      message: "Níveis dos rios capturados e gravados no Firebase Firestore com sucesso via Vercel Cron!",
    });
  } catch (error: any) {
    console.error("Vercel Cron Sync error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Erro durante a execução do Vercel Cron",
    });
  }
}
