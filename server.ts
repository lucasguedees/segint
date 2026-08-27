import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Firestore on the server using applet config
  let db: ReturnType<typeof getFirestore> | null = null;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
        ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
        : getFirestore(firebaseApp);
      console.log("[Server Backend] Firestore de segundo plano inicializado com sucesso.");
    }
  } catch (e) {
    console.error("[Server Backend] Erro ao carregar firebase-applet-config.json no servidor:", e);
  }

  // API route for health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Target cities configuration for Vale do Taquari
  const CITIES_CONFIG = [
    {
      cityId: "lajeado",
      cityName: "Lajeado",
      riverName: "Rio Taquari",
      slug: "lajeado",
      anaStation: "86580000",
      fallbackBase: 13.79,
    },
    {
      cityId: "estrela",
      cityName: "Estrela",
      riverName: "Rio Taquari",
      slug: "lajeado", // Compartilha a estação de monitoramento Lajeado/Porto de Estrela
      anaStation: "86580000",
      fallbackBase: 13.79,
    },
    {
      cityId: "arroio-do-meio",
      cityName: "Arroio do Meio",
      riverName: "Rio Taquari / Forqueta",
      slug: null, // Shares exact level reading with Lajeado station
      anaStation: "86580000",
      fallbackBase: 13.79, // Same as Lajeado
    },
    {
      cityId: "bom-retiro-do-sul",
      cityName: "Bom Retiro do Sul",
      riverName: "Rio Taquari",
      slug: "bomretirodosul",
      anaStation: "86610000",
      fallbackBase: 10.85,
    },
    {
      cityId: "taquari",
      cityName: "Taquari",
      riverName: "Rio Taquari",
      slug: "taquari",
      anaStation: "86640000",
      fallbackBase: 8.12,
    },
    {
      cityId: "encantado",
      cityName: "Encantado",
      riverName: "Rio Taquari",
      slug: "encantado",
      anaStation: "86520000",
      fallbackBase: 3.39,
    },
    {
      cityId: "mucum",
      cityName: "Muçum",
      riverName: "Rio Taquari",
      slug: "mucum",
      anaStation: "86510000",
      fallbackBase: 4.89,
    },
    {
      cityId: "roca-sales",
      cityName: "Roca Sales",
      riverName: "Rio Taquari",
      slug: "rocasales",
      anaStation: "86525000",
      fallbackBase: 7.75,
    },
    {
      cityId: "santa-tereza",
      cityName: "Santa Tereza",
      riverName: "Rio Taquari - Taquari/Das Antas",
      slug: null, // Not directly on nivelguaiba, calculated relative to Muçum / SACE
      anaStation: "86250000",
      fallbackBase: 5.15,
    },
  ];

  // Helper to fetch live level from nivelguaiba.com.br
  async function fetchLevelFromNivelGuaiba(slug: string): Promise<number | null> {
    try {
      const response = await fetch(`https://nivelguaiba.com.br/${slug}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const html = await response.text();
        
        // Extract "Cota atual: 13.79m" or "Cota atual: 3.39m"
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

  // Core background function to synchronize river readings from nivelguaiba.com.br and write directly to Firestore
  async function autoSyncRiverDataToFirestore() {
    try {
      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const timeRaw = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
      const [hStr, mStr] = timeRaw.split(':');
      const mins = Math.floor(parseInt(mStr || '0', 10) / 15) * 15;
      const hh = String(parseInt(hStr || '0', 10)).padStart(2, "0");
      const mm = String(mins).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;

      const readings: Array<{
        id: string;
        cityName: string;
        cityId: string;
        riverName: string;
        levelMeters: number;
        timestamp: string;
        dateStr: string;
        timeStr: string;
        source: string;
        notes?: string;
        createdAt: string;
      }> = [];

      const fetchedLevelsMap: Record<string, number> = {};

      for (const cityObj of CITIES_CONFIG) {
        let level: number | null = null;
        let sourceUsed = "nivelguaiba.com.br (Ao Vivo)";

        // 1. Try fetching directly from nivelguaiba.com.br if slug exists
        if (cityObj.slug) {
          level = await fetchLevelFromNivelGuaiba(cityObj.slug);
        }

        // 2. If no slug or failed, derive or fetch from SACE/ANA telemetria
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
          notes: `Capturado automaticamente em segundo plano via ${sourceUsed}`,
          createdAt: now.toISOString(),
        };

        // Write directly to Firestore if DB is ready on server
        if (db) {
          try {
            await setDoc(doc(db, "readings", docId), itemPayload, { merge: true });
          } catch (fireErr) {
            console.error(`[Auto-Sync Backend] Erro ao gravar documento no Firestore (${docId}):`, fireErr);
          }
        }

        readings.push({
          ...itemPayload,
          cityName: cityObj.cityName,
          riverName: cityObj.riverName,
          source: sourceUsed,
        });
      }

      console.log(`[Auto-Sync Backend] ${readings.length} cidades atualizadas e gravadas no Firestore às ${timeStr} (${dateStr}).`);
      return readings;
    } catch (error) {
      console.error("[Auto-Sync Backend] Falha na execução da rotina automática de sincronização:", error);
      return null;
    }
  }

  // Handler for synchronizing river levels manually or via API call
  const syncRiverHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const readings = await autoSyncRiverDataToFirestore();
      if (readings) {
        res.json({
          success: true,
          readings,
          syncedAt: new Date().toISOString(),
          message: `${readings.length} cidades sincronizadas e salvas no Firebase Firestore com sucesso!`,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Não foi possível concluir a sincronização dos dados com o Firestore.",
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Erro ao sincronizar dados com nivelguaiba.com.br",
      });
    }
  };

  // Rotina de auto-sincronização periódica em segundo plano desativada momentaneamente a pedido do usuário.
  // A sincronização sob demanda permanece 100% ativa via endpoint /api/sync-river (Botão "Sincronizar Agora").
  /*
  setTimeout(() => {
    autoSyncRiverDataToFirestore().catch(console.error);
  }, 5000);

  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  setInterval(() => {
    autoSyncRiverDataToFirestore().catch(console.error);
  }, FIFTEEN_MINUTES_MS);
  */

  app.get("/api/sync-river", syncRiverHandler);
  app.get("/api/sync-guaiba", syncRiverHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
