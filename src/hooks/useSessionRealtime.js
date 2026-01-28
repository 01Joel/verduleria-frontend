import { useEffect } from "react";
import { io } from "socket.io-client";

/**
 * Recomendación:
 * - VITE_API_URL = http://localhost:3000 (tu backend)
 * - credentials true si usas cookies; si usas JWT header, no hace falta.
 */
const API_URL = import.meta.env.VITE_API_URL;

export function useSessionRealtime({ sessionId, onDailyPriceUpdated, onPromotionsUpdated }) {
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(API_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      socket.emit("session:join", { sessionId });
    });

    if (onDailyPriceUpdated) {
      socket.on("daily_price_updated", onDailyPriceUpdated);
    }

    if (onPromotionsUpdated) {
      socket.on("promotions_updated", onPromotionsUpdated);
    }

    return () => {
      try {
        socket.emit("session:leave", { sessionId });
        socket.disconnect();
      } catch {
        // no-op
      }
    };
  }, [sessionId, onDailyPriceUpdated, onPromotionsUpdated]);
}
