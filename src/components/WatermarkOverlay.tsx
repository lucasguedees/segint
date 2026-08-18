import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";

interface WatermarkOverlayProps {
  user: UserProfile;
}

export default function WatermarkOverlay({ user }: WatermarkOverlayProps) {
  const [currentTimestamp, setCurrentTimestamp] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formattedDate = now.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const formattedTime = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentTimestamp(`${formattedDate} ${formattedTime}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case "\"": return "&quot;";
        default: return c;
      }
    });
  };

  const operatorName = escapeXml((user.name || "OPERADOR").toUpperCase());
  const operatorEmail = escapeXml(user.email || "segint.operador");
  const operatorBadge = escapeXml(
    user.badgeId ? `MAT: ${user.badgeId.toUpperCase()}` : `ID: ${user.uid.slice(0, 8).toUpperCase()}`
  );
  const operatorLotacao = user.lotacao ? escapeXml(` · ${user.lotacao.toUpperCase()}`) : "";

  // Watermark text unit
  const line1 = `${operatorName} · ${operatorBadge}${operatorLotacao}`;
  const line2 = `${operatorEmail} · ${currentTimestamp} · SISPIR`;

  // Create an SVG-based pattern for ultra-sharp, performant, repeat background
  const svgWatermark = `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="260">
      <g transform="rotate(-22, 240, 130)" text-anchor="middle" fill="#ffffff" font-family="monospace, sans-serif" font-weight="bold" letter-spacing="1.2px" opacity="0.045">
        <text x="240" y="115" font-size="11">${line1}</text>
        <text x="240" y="140" font-size="10">${line2}</text>
      </g>
    </svg>
  `;

  const encodedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svgWatermark)}`;

  return (
    <div
      id="forensic-watermark-overlay"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-[9999] overflow-hidden mix-blend-screen print:opacity-40"
      style={{
        backgroundImage: `url("${encodedSvg}")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
