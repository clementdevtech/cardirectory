import { useEffect } from "react";
import { saveCarDraft } from "@/utils/carDraft";

export const useCarDraft = (userId: string, form: any) => {
  useEffect(() => {
    if (!userId) return;

    const t = setTimeout(() => {
      saveCarDraft(userId, form);
    }, 800); // debounce

    return () => clearTimeout(t);
  }, [form, userId]);
};
