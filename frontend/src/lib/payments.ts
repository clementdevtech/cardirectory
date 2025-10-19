// src/lib/payments.ts
export const initiateStk = async (apiBase: string, phone: string, amount: number) => {
  const resp = await fetch(`${apiBase}/mpesa/stk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, amount, accountRef: "CarDirectory", description: "Plan purchase" }),
  });
  if (!resp.ok) throw new Error("STK push failed");
  return resp.json();
};
