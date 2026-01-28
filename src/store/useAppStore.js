import { create } from "zustand";

function safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function computeIsAdmin(user) {
  return String(user?.role || "").toUpperCase() === "ADMIN";
}

export const useAppStore = create((set, get) => {
  const user = safeParse("user");

  return {
    token: localStorage.getItem("token"),
    user,
    role: user?.role || null,
    isAdmin: computeIsAdmin(user), // ✅ BOOLEAN REAL

    setAuth: ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      set({
        token,
        user,
        role: user?.role || null,
        isAdmin: computeIsAdmin(user),
      });
    },

    logout: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({ token: null, user: null, role: null, isAdmin: false });
    },
  };
});
