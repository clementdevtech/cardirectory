const DRAFT_KEY = "dealer_car_draft";

export const saveCarDraft = (userId: string, data: any) => {
  localStorage.setItem(`${DRAFT_KEY}_${userId}`, JSON.stringify(data));
};

export const loadCarDraft = (userId: string) => {
  const raw = localStorage.getItem(`${DRAFT_KEY}_${userId}`);
  return raw ? JSON.parse(raw) : null;
};

export const clearCarDraft = (userId: string) => {
  localStorage.removeItem(`${DRAFT_KEY}_${userId}`);
};
